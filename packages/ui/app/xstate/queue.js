import { setup, assign, fromPromise } from 'xstate';
import pollLogic from './poll';

export default function createQueueMachine({
  getQueue,
  joinQueue,
  refreshQueue,
  upload,
  getProgress,
  getFrames,
  cancel,
}) {
  return setup({
    actors: {
      poll: pollLogic,
      join: fromPromise(() => joinQueue()),
      upload: fromPromise(({ input }) => upload(input)),
      cancel: fromPromise(() => cancel()),
    },

    guards: {
      isIdle: ({ context }) => context.status === 'idle',
      isWaiting: ({ context }) => context.status === 'waiting',
      isReady: ({ context }) => context.status === 'ready' && context.file === null,
      isUploading: ({ context }) => context.status === 'ready' && context.file !== null,
      isProcessing: ({ context }) => context.status === 'processing',
      isFailed: ({ context }) => context.status === 'failed',
      isFinished: ({ context }) => context.status === 'finished',
      isStitched: ({ context }) => context.status === 'finished' && context.progress.stitch === 100,
      isUnavailable: ({ context }) => context.status === 'unavailable',
      extractStarted: ({ context }) => context.progress.extract > 0,
    },
  }).createMachine({
    id: 'queue',

    context: {
      status: null,
      error: null,
      position: null,
      total: null,

      file: null,
      processor: 'real-esrgan',
      interpolation: 'none',
      jobId: null,

      progress: {
        extract: 0,
        enhance: 0,
        stitch: 0,
      },

      frames: 0,
    },

    // Poll the queue for the whole lifetime of the machine.
    invoke: {
      id: 'getQueue',
      src: 'poll',
      input: {
        callback: getQueue,
        timeout: 2000,
        event: 'UPDATE_QUEUE',
      },
    },

    on: {
      UPDATE_QUEUE: {
        actions: assign({
          status: ({ event }) => event.data.status,
          position: ({ event }) => event.data.position,
          total: ({ event }) => event.data.total,
        }),
      },
    },

    initial: 'unknown',

    states: {
      // Bootstrap: route to the right state from the server-reported status
      // (this is what enables resuming an in-flight job after a reload).
      unknown: {
        always: [
          { target: 'idle', guard: 'isIdle' },
          { target: 'active.waiting', guard: 'isWaiting' },
          { target: 'active.ready', guard: 'isReady' },
          { target: 'active.uploading', guard: 'isUploading' },
          { target: 'active.processing', guard: 'isProcessing' },
          { target: 'failed', guard: 'isFailed' },
          { target: 'finished', guard: 'isFinished' },
          { target: 'unavailable', guard: 'isUnavailable' },
        ],
      },

      idle: {
        on: {
          UPLOAD: {
            target: 'joining',
            actions: assign({ file: ({ event }) => event.file, processor: ({ event }) => event.processor ?? 'real-esrgan', interpolation: ({ event }) => event.interpolation ?? 'none' }),
          },
        },
      },

      joining: {
        invoke: {
          id: 'join',
          src: 'join',
          onError: {
            target: 'error',
            actions: assign({
              error: ({ event }) => {
                const { error } = event;

                if (error.response) {
                  return error.response.data.message;
                }

                return error.message;
              },
            }),
          },
        },

        always: [
          { target: 'active.waiting', guard: 'isWaiting' },
          { target: 'active.ready', guard: 'isReady' },
          { target: 'active.uploading', guard: 'isUploading' },
        ],
      },

      active: {
        // Tell the server we're still here; result is ignored (no event).
        invoke: {
          id: 'refreshQueue',
          src: 'poll',
          input: {
            callback: refreshQueue,
            timeout: 30000,
          },
        },

        always: [
          { target: 'idle', guard: 'isIdle' },
          { target: 'failed', guard: 'isFailed' },
          { target: 'finished', guard: 'isStitched' },
        ],

        initial: 'waiting',

        states: {
          waiting: {
            always: [
              { target: 'ready', guard: 'isReady' },
              { target: 'uploading', guard: 'isUploading' },
            ],
          },

          ready: {
            on: {
              UPLOAD: {
                target: 'uploading',
                actions: assign({ file: ({ event }) => event.file, processor: ({ event }) => event.processor ?? 'real-esrgan', interpolation: ({ event }) => event.interpolation ?? 'none' }),
              },
            },
          },

          uploading: {
            invoke: {
              id: 'upload',
              src: 'upload',
              input: ({ context }) => ({
                file: context.file,
                processor: context.processor,
                interpolation: context.interpolation,
              }),
              onDone: {
                target: 'processing',
                actions: assign({ jobId: ({ event }) => event.output.job }),
              },
              onError: {
                target: '#queue.error',
                actions: assign({
                  error: ({ event }) => {
                    const { error } = event;

                    if (!error.response) {
                      return error.message;
                    }

                    let message = `${error.response.data.message}.`;

                    if (error.response.data.errors) {
                      message += `\n${error.response.data.errors.join('\n')}`;
                    }

                    return message;
                  },
                }),
              },
            },
          },

          processing: {
            // Poll progress for the whole processing phase (auto-stops on exit).
            invoke: {
              id: 'progress',
              src: 'poll',
              input: ({ context }) => ({
                callback: () => getProgress(context.jobId),
                timeout: 2000,
                event: 'UPDATE_PROGRESS',
              }),
            },

            on: {
              UPDATE_PROGRESS: {
                actions: assign({
                  progress: ({ event }) => event.data.progress,
                  processedOn: ({ event }) => event.data.processedOn,
                }),
              },

              CANCEL: {
                target: '#queue.cancelling',
              },
            },

            // Only start polling frames once extraction has begun.
            initial: 'extracting',

            states: {
              extracting: {
                always: { target: 'comparing', guard: 'extractStarted' },
              },

              comparing: {
                invoke: {
                  id: 'frames',
                  src: 'poll',
                  input: {
                    callback: getFrames,
                    timeout: 2000,
                    event: 'UPDATE_FRAMES',
                  },
                },

                on: {
                  UPDATE_FRAMES: {
                    actions: assign({ frames: ({ event }) => event.data }),
                  },
                },
              },
            },
          },
        },
      },

      cancelling: {
        invoke: {
          id: 'cancel',
          src: 'cancel',
        },
      },

      error: {
        on: {
          UPLOAD: {
            target: 'joining',
            actions: assign({ file: ({ event }) => event.file, processor: ({ event }) => event.processor ?? 'real-esrgan', interpolation: ({ event }) => event.interpolation ?? 'none' }),
          },
        },
      },

      failed: {
        entry: assign({
          error: () => 'Something went wrong on the server while processing your file. Consider reporting this to the Discord server.',
        }),
        on: {
          UPLOAD: {
            target: 'joining',
            actions: assign({ file: ({ event }) => event.file, processor: ({ event }) => event.processor ?? 'real-esrgan', interpolation: ({ event }) => event.interpolation ?? 'none' }),
          },
        },
      },

      finished: {
        on: {
          UPLOAD: {
            target: 'joining',
            actions: assign({ file: ({ event }) => event.file, processor: ({ event }) => event.processor ?? 'real-esrgan', interpolation: ({ event }) => event.interpolation ?? 'none' }),
          },
        },
      },

      unavailable: {
        type: 'final',
      },
    },
  });
}
