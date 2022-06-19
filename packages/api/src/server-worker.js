const { createClient } = require('redis');
const Bull = require('bull');
const createJobLogger = require('./jobs');
const jobsWorker = require('./worker/jobs');

if (require.main === module) {
  const redisURL = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;
  const redisDB = createClient({ url: redisURL });
  const jobLogger = createJobLogger(redisDB);
  const upscaleQueue = new Bull('upscale', redisURL);

  redisDB.connect();

  jobsWorker(jobLogger, upscaleQueue);
} else {
  //
}
