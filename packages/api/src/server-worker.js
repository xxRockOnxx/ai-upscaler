const { createClient } = require('redis');
const Bull = require('bull');
const createJobsDB = require('./upscaler/db');
const createQueueDB = require('./queue/db');
const createDownloadsDB = require('./downloads/db');
const jobsWorker = require('./worker/jobs');
const downloadsWorker = require('./worker/downloads');

if (!process.env.REDIS_HOST) {
  throw new Error('missing `REDIS_HOST` env variable');
}

if (!process.env.REDIS_PORT) {
  throw new Error('missing `REDIS_PORT` env variable');
}

if (!process.env.REAL_ESRGAN_PATH) {
  throw new Error('missing `REAL_ESRGAN_PATH` env variable');
}

const redisURL = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;
const redisDB = createClient({ url: redisURL });
const queueDB = createQueueDB(redisDB);
const jobsDB = createJobsDB(redisDB);
const downloadsDB = createDownloadsDB(redisDB);
const upscaleQueue = new Bull('upscale', redisURL);

redisDB.connect();

jobsWorker(queueDB, jobsDB, downloadsDB, upscaleQueue);
downloadsWorker(downloadsDB, upscaleQueue);
