const { createClient } = require('redis');
const { interpret } = require('xstate');
const Bull = require('bull');
const createJobLogger = require('./jobs');
const upscaler = require('./xstate/upscaler');

/**
 * @param {import("./jobs")} jobLogger
 * @param {import("bull").Queue} queue
 */
function main(jobLogger, queue) {
  // Reuse Bull's redis pubsub for listening
  // to our custom event `cancel`.
  queue.eclient.subscribe('cancel', (err) => {
    if (err) {
      throw err;
    }
  });

  queue.process(async (job) => {
    const interpreter = interpret(
      upscaler.withContext({
        workDir: job.data.workDir,
        input: job.data.input,
        metadata: job.data.metadata,
      }),
    );

    // `job.data.id` represents who owns the job (could be user id).
    // `job.id` is the id of a job that will process something.
    await jobLogger.save(job.data.id, {
      id: job.id,
    });

    function cancelHandler(channel, data) {
      if (channel !== 'cancel') {
        return;
      }

      if (job.id !== data) {
        return;
      }

      interpreter.send('CANCEL');
    }

    queue.eclient.on('message', cancelHandler);

    await new Promise((resolve, reject) => {
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
          interpreter.stop();
          queue.eclient.off('message', cancelHandler);
          if (interpreter.state.value === 'done') {
            resolve();
          } else if (evt.data.canceled) {
            reject(new Error('Job canceled'));
          } else {
            reject(new Error('Unexpected error occured while processing'));
          }
        })
        .start();
    });
  });
}

if (require.main === module) {
  const redisURL = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;
  const redisDB = createClient({ url: redisURL });
  const jobLogger = createJobLogger(redisDB);
  const upscaleQueue = new Bull('upscale', redisURL);

  redisDB.connect();

  main(jobLogger, upscaleQueue);
} else {
  module.exports = main;
}
