const { interpret } = require('xstate');
const uuid = require('uuid').v4;
const Storage = require('../storage');
const StorageDownloads = require('../storage-downloads');
const createUpscalerMachine = require('../xstate/upscaler');

function createCancelHandler(interpreter, job) {
  return function cancelHandler(channel, data) {
    if (channel !== 'cancel') {
      return;
    }

    if (job.id !== data) {
      return;
    }

    interpreter.send('CANCEL');
  };
}

/**
 * @param {import("../jobs")} jobLogger
 * @param {import("bull").Queue} queue
 */
module.exports = function jobs(jobLogger, queue) {
  // Reuse Bull's redis pubsub for listening
  // to our custom event `cancel`.
  queue.eclient.subscribe('cancel', (err) => {
    if (err) {
      throw err;
    }
  });

  queue.process(async (job) => {
    const storage = new StorageDownloads(job.data.id);
    const outputFile = storage.path(`${uuid()}.mp4`);

    await storage.initialize();

    const machine = createUpscalerMachine({
      input: job.data.input,
      output: outputFile,
      metadata: job.data.metadata,
      storage: new Storage(job.data.id),
    });

    const interpreter = interpret(machine);

    // `job.data.id` represents the owner of the job (could be user id).
    // `job.id` represents the specific job of an owner.
    await jobLogger.save(job.data.id, {
      id: job.id,
    });

    const cancelHandler = createCancelHandler(interpreter, job);

    queue.eclient.on('message', cancelHandler);

    return new Promise((resolve, reject) => {
      interpreter
        .onEvent((event) => {
          if (event.type === 'PROGRESS') {
            jobLogger.set(
              job.data.id,
              'progress',
              interpreter.state.context.progress,
            );
          }
        })
        .onDone((evt) => {
          queue.eclient.off('message', cancelHandler);
          if (interpreter.state.value === 'done') {
            resolve({ output: outputFile });
          } else if (evt.data.canceled) {
            reject(new Error('Job canceled'));
          } else {
            reject(new Error('Unexpected error occured while processing'));
          }
        })
        .start();
    });
  });
};
