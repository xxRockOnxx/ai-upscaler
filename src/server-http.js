const { createClient } = require('redis');
const fastify = require('fastify');
const fastifyCookie = require('@fastify/cookie');
const fastifyMultipart = require('@fastify/multipart');
const crypto = require('crypto-random-string');
const fs = require('fs-extra');
const Bull = require('bull');
const createQueue = require('./queue');
const createJobLogger = require('./jobs');
const getQueue = require('./http/get-queue');
const putQueue = require('./http/put-queue');
const postSubmit = require('./http/post-submit');
const getProgress = require('./http/get-progress');
const putCancel = require('./http/put-cancel');
const getFrames = require('./http/get-frames');
const getFrame = require('./http/get-frame');

/**
 * @returns {Promise<fastify.FastifyInstance>}
 */
async function createServer() {
  const server = fastify({
    logger: {
      level: "error",
      prettyPrint: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  });

  await server.register(fastifyCookie, {
    secret: crypto({ length: 32 }),
    parserOptions: {
      signed: true,
    }
  });

  await server.register(fastifyMultipart, {
    limits: {
      files: 1,

      // This is equal to 5MB
      fileSize: 5 * 1000000,
    },
  });

  return server;
}

function createAssertQueue(queue) {
  return async function assertQueue(request, reply) {
    const queueList = await queue.getAll();

    if (!request.cookies.queue || !queueList[request.cookies.queue]) {
      reply.code(400).send('Not in queue or invalid queue id');
    }
  };
}

async function start() {
  const redisURL = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;

  // This will be used for saving data e.g queue, job logs, etc.
  const redisDB = createClient({ url: redisURL });

  // This will be used for publishing to workers e.g for job cancellation.
  const redisPub = createClient({ url: redisURL });

  await redisDB.connect();
  await redisPub.connect();

  const queue = createQueue(redisDB);
  const jobLogger = createJobLogger(redisDB);
  const upscaleQueue = new Bull('upscale', redisURL);
  const server = await createServer();

  server.get('/queue', getQueue(queue));
  server.put('/queue', putQueue(queue));

  server.route({
    method: 'GET',
    url: '/progress',
    preHandler: [createAssertQueue(queue)],
    handler: getProgress(queue, jobLogger),
  });

  server.route({
    method: 'GET',
    url: '/frames',
    preHandler: [createAssertQueue(queue)],
    handler: getFrames(),
  });

  server.route({
    method: 'GET',
    url: '/frame/:frame',
    preHandler: [createAssertQueue(queue)],
    handler: getFrame(),
  });

  server.route({
    method: 'POST',
    url: '/submit',
    preHandler: [createAssertQueue(queue)],
    handler: postSubmit(queue, upscaleQueue),
  });

  server.route({
    method: 'PUT',
    url: '/cancel',
    preHandler: [createAssertQueue(queue)],
    handler: putCancel(redisPub, queue, jobLogger),
  });

  await server.listen(3000, '0.0.0.0');

  upscaleQueue.on('global:completed', (job) => {
    server.log.info('Marking job as completed');

    upscaleQueue
      .getJob(job)
      .then((storedJob) => {
        fs.remove(storedJob.data.input);
        return queue.markAsStatus(storedJob.data.id, 'finished');
      })
      .then(() => queue.sort());
  });

  upscaleQueue.on('global:failed', (job, err) => {
    server.log.error(err);
    server.log.info('Marking job as failed');

    upscaleQueue
      .getJob(job)
      .then((storedJob) => {
        fs.remove(storedJob.data.input);
        return queue.markAsStatus(storedJob.data.id, 'failed');
      })
      .then(() => queue.sort());
  });
}

start();
