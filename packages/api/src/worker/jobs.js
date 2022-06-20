const { interpret } = require('xstate');
const uuid = require('uuid').v4;
const Storage = require('../upscaler/storage');
const StorageDownloads = require('../downloads/storage');
const createUpscalerMachine = require('./xstate/upscaler');
const createCompleteListener = require('./listener-complete');
const createFailedListener = require('./listener-failed');

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

module.exports = function jobs(queuedB, jobsDB, bullQueue) {
  bullQueue.on('completed', createCompleteListener(queuedB));
  bullQueue.on('failed', createFailedListener(queuedB));

  // Reuse Bull's redis pubsub for listening to our custom event `cancel`.
  bullQueue.eclient.subscribe('cancel', (err) => {
    if (err) {
      throw err;
    }
  });

  bullQueue.process(async (job) => {
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
    await jobsDB.save(job.data.id, {
      id: job.id,
    });

    const cancelHandler = createCancelHandler(interpreter, job);

    bullQueue.eclient.on('message', cancelHandler);

    return new Promise((resolve, reject) => {
      interpreter
        .onEvent((event) => {
          if (event.type === 'PROGRESS') {
            jobsDB.set(
              job.data.id,
              'progress',
              interpreter.state.context.progress,
            );
          }
        })
        .onDone((evt) => {
          bullQueue.eclient.off('message', cancelHandler);
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
