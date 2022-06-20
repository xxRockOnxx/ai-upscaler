const { createClient } = require('redis');
const Bull = require('bull');
const createJobLogger = require('./jobs');
const createQueue = require('./queue');
const createDownloads = require('./downloads/db');
const jobsWorker = require('./worker/jobs');
const downloadsWorker = require('./worker/downloads');

const redisURL = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;
const redisDB = createClient({ url: redisURL });
const queueDB = createQueue(redisDB);
const jobsDB = createJobLogger(redisDB);
const downloadsDB = createDownloads(redisDB);
const upscaleQueue = new Bull('upscale', redisURL);

redisDB.connect();

jobsWorker(queueDB, jobsDB, upscaleQueue);
downloadsWorker(downloadsDB, upscaleQueue);
