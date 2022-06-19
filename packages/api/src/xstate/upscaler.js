const { createMachine, assign, send } = require('xstate');
const extract = require('../upscaler/extract');
const enhance = require('../upscaler/enhance');
const stitch = require('../upscaler/stitch');

/**
 * This is a utility function that creates an XState callback-style service.
 * This add progress tracker and cancel callback to the service.
 *
 * @param {string} name - Name of service that will be used when updating progress.
 * @param {Function} fn - The function that will do the process.
 * @param {Function} dataFn - The function that will return data to be passed to the `fn` function.
 * @returns {Function} - A function that XState can use for defining a service.
 */
function createService(name, fn, dataFn) {
  // https://xstate.js.org/docs/guides/communication.html#invoking-callbacks
  return function service(context) {
    return function callback(sendParent, receive) {
      console.log(`${name} service started`);

      let cancelFn = () => {};

      receive((e) => {
        if (e.type === 'CANCEL') {
          cancelFn();
        }
      });

      fn({
        data: dataFn(context),

        progress(progress) {
          sendParent({
            type: 'PROGRESS',
            progress: {
              ...context.progress,
              [name]: progress,
            },
          });
        },

        onCancel(jobCancelFn) {
          cancelFn = jobCancelFn;
        },
      })
        .then(() => {
          sendParent({
            type: 'DONE',
          });
        })
        .catch((e) => {
          console.error(e);
          sendParent({
            type: 'ERROR',
            canceled: e.name === 'CancelError',
          });
        });
    };
  };
}

/**
 * @param {string} input - Path to input video file.
 * @param {string} output - Path to output video file.
 * @param {object} metadata - Metadata of the input video file.
 * @param {import('../storage')} storage - Storage to be used for retrieving and storing files.
 */
module.exports = function createUpscaleMachine({
  input,
  output,
  metadata,
  storage,
}) {
  return createMachine(
    {
      id: 'upscaler',

      initial: 'prepare',

      context: {
        input,
        output,
        metadata,
        storage,
        progress: {
          extract: 0,
          enhance: 0,
          stitch: 0,
        },
      },

      on: {
        PROGRESS: {
          actions: assign({
            progress: (ctx, event) => event.progress,
          }),
        },
      },

      states: {
        prepare: {
          invoke: {
            id: 'prepare',
            src: 'prepare',
            onDone: {
              target: 'extract',
            },
            onError: {
              target: 'failed',
            },
          },
        },

        extract: {
          invoke: {
            id: 'extract',
            src: 'extract',
          },

          on: {
            DONE: {
              target: 'enhance',
            },

            ERROR: {
              target: 'failed',
            },

            CANCEL: {
              actions: send({ type: 'CANCEL' }, { to: 'extract' }),
            },
          },
        },

        enhance: {
          invoke: {
            id: 'enhance',
            src: 'enhance',
          },

          on: {
            DONE: {
              target: 'stitch',
            },

            ERROR: {
              target: 'failed',
            },

            CANCEL: {
              actions: send({ type: 'CANCEL' }, { to: 'enhance' }),
            },
          },
        },

        stitch: {
          invoke: {
            id: 'stitch',
            src: 'stitch',
          },

          on: {
            DONE: {
              target: 'done',
            },

            ERROR: {
              target: 'failed',
            },

            CANCEL: {
              actions: send({ type: 'CANCEL' }, { to: 'stitch' }),
            },
          },
        },

        done: {
          type: 'final',
        },

        failed: {
          type: 'final',
          data: {
            canceled: (ctx, evt) => evt.canceled,
          },
        },
      },
    },
    {
      services: {
        prepare(context) {
          return Promise.all([
            context.storage.mkFramesDir(),
            context.storage.mkEnhancedDir(),
          ]);
        },

        extract: createService('extract', extract, (context) => ({
          input: context.input,
          output: context.storage.framesPath('frame_%03d.png'),
        })),

        enhance: createService('enhance', enhance, (context) => ({
          input: context.storage.framesPath(),
          output: context.storage.enhancedPath(),
        })),

        stitch: createService('stitch', stitch, (context) => ({
          input: context.storage.enhancedPath('frame_%03d.png'),
          output: context.output,
          metadata: context.metadata,
        })),
      },
    },
  );
};
