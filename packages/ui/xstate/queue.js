import { createMachine, assign, spawn, sendParent } from 'xstate'
import createPollMachine from './poll'

export default function createQueueMachine ({
  getQueue,
  joinQueue,
  refreshQueue,
  upload,
  getProgress,
  getFrames,
  cancel
}) {
  return createMachine({
    id: 'queue',

    context: {
      status: null,
      position: null,
      total: null,

      file: null,

      refreshQueueMachine: null,
      progressMachine: null,
      framesMachine: null,

      progress: {
        extract: 0,
        enhance: 0,
        stitch: 0
      },

      frames: []
    },

    invoke: {
      id: 'getQueue',
      src: createPollMachine({
        timeout: 2000,
        callback: getQueue,
        onDone: sendParent((_, evt) => ({
          type: 'UPDATE_QUEUE',
          data: evt.data
        }))
      })
    },

    on: {
      UPDATE_QUEUE: {
        actions: assign((_, event) => {
          return {
            status: event.data.status,
            position: event.data.position,
            total: event.data.total
          }
        })
      }
    },

    initial: 'unknown',

    states: {
      unknown: {
        always: [
          {
            target: 'idle',
            cond: ({ status }) => status === 'idle'
          },
          {
            target: 'active.waiting',
            cond: ({ status }) => status === 'waiting'
          },
          {
            target: 'active.ready',
            cond: ({ status, file }) => status === 'ready' && file === null
          },
          {
            target: 'active.uploading',
            cond: ({ status, file }) => status === 'ready' && file !== null
          },
          {
            target: 'active.processing',
            cond: ({ status }) => status === 'processing'
          },
          {
            target: 'failed',
            cond: ({ status }) => status === 'failed'
          },
          {
            target: 'finished',
            cond: ({ status }) => status === 'finished'
          }
        ]
      },

      idle: {
        on: {
          UPLOAD: {
            target: 'joining',
            actions: assign({
              file: (_, event) => event.file
            })
          }
        }
      },

      joining: {
        invoke: {
          id: 'join',
          src: () => joinQueue(),
          onError: {
            target: 'error'
          }
        },

        always: [
          {
            target: 'active.waiting',
            cond: ({ status }) => status === 'waiting'
          },
          {
            target: 'active.ready',
            cond: ({ status, file }) => status === 'ready' && file === null
          },
          {
            target: 'active.uploading',
            cond: ({ status, file }) => status === 'ready' && file !== null
          }
        ]
      },

      active: {
        entry: assign({
          refreshQueueMachine: () => spawn(createPollMachine({
            timeout: 30000,
            callback: refreshQueue
          }))
        }),

        exit: (ctx) => {
          ctx.refreshQueueMachine.stop()
          ctx.refreshQueueMachine = null
        },

        always: [
          {
            target: 'idle',
            cond: ({ status }) => status === 'idle'
          },
          {
            target: 'failed',
            cond: ({ status }) => status === 'failed'
          },
          {
            target: 'finished',
            cond: ({ status, progress }) => status === 'finished' && progress.stitch === 100
          }
        ],

        states: {
          waiting: {
            always: [
              {
                target: 'ready',
                cond: ({ status, hasFile }) => status === 'ready' && !hasFile
              },
              {
                target: 'uploading',
                cond: ({ status, hasFile }) => status === 'ready' && hasFile
              }
            ]
          },

          ready: {
            on: {
              UPLOAD: {
                target: 'uploading',
                actions: assign({
                  file: (_, event) => event.file
                })
              }
            }
          },

          uploading: {
            invoke: {
              id: 'upload',
              src: ({ file }) => upload(file),
              onDone: 'processing',
              onError: '#queue.error'
            }
          },

          processing: {
            entry: assign({
              progressMachine: () => spawn(createPollMachine({
                timeout: 2000,
                callback: getProgress,
                onDone: sendParent((_, evt) => ({
                  type: 'UPDATE_PROGRESS',
                  progress: evt.data
                }))
              })),

              framesMachine: () => spawn(createPollMachine({
                timeout: 2000,
                callback: getFrames,
                onDone: sendParent((_, evt) => ({
                  type: 'UPDATE_FRAMES',
                  frames: evt.data
                }))
              }))
            }),

            exit: (ctx) => {
              ctx.progressMachine.stop()
              ctx.progressMachine = null
            },

            on: {
              UPDATE_PROGRESS: {
                actions: assign({
                  progress: (_, event) => event.progress
                })
              },

              UPDATE_FRAMES: {
                actions: assign({
                  frames: (_, event) => event.frames
                })
              },

              CANCEL: {
                target: '#queue.cancelling'
              }
            }
          }
        }
      },

      cancelling: {
        invoke: {
          id: 'cancel',
          src: () => cancel(),
          onDone: 'failed'
        }
      },

      error: {
        on: {
          UPLOAD: {
            target: 'joining',
            actions: assign({
              file: (_, event) => event.file
            })
          }
        }
      },

      failed: {
        on: {
          UPLOAD: {
            target: 'joining',
            actions: assign({
              file: (_, event) => event.file
            })
          }
        }

        // always: [
        //   {
        //     target: 'active.waiting',
        //     cond: ({ status }) => status === 'waiting'
        //   },
        //   {
        //     target: 'active.ready',
        //     cond: ({ status, file }) => status === 'ready' && file === null
        //   },
        //   {
        //     target: 'active.uploading',
        //     cond: ({ status, file }) => status === 'ready' && file !== null
        //   }
        // ]
      },

      finished: {
        on: {
          UPLOAD: {
            target: 'joining',
            actions: assign({
              file: (_, event) => event.file
            })
          }
        }
      }
    }
  })
}
