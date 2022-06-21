const { createClient } = require('redis');
const Bull = require('bull');
const createJobsDB = require('./upscaler/db');
const createQueueDB = require('./queue/db');
const createDownloadsDB = require('./downloads/db');
const jobsWorker = require('./worker/jobs');
const downloadsWorker = require('./worker/downloads');

const redisURL = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;
const redisDB = createClient({ url: redisURL });
const queueDB = createQueueDB(redisDB);
const jobsDB = createJobsDB(redisDB);
const downloadsDB = createDownloadsDB(redisDB);
const upscaleQueue = new Bull('upscale', redisURL);

redisDB.connect();

jobsWorker(queueDB, jobsDB, downloadsDB, upscaleQueue);
downloadsWorker(downloadsDB, upscaleQueue);
