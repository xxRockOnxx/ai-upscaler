const { createClient } = require('redis');
const fastify = require('fastify');
const fastifyCookie = require('@fastify/cookie');
const fastifyMultipart = require('@fastify/multipart');
const crypto = require('crypto-random-string');
const Bull = require('bull');
const createQueue = require('./queue');
const createJobLogger = require('./jobs');
const createDownloads = require('./downloads/db');
const getQueue = require('./http/get-queue');
const putQueue = require('./http/put-queue');
const postSubmit = require('./http/post-submit');
const getProgress = require('./http/get-progress');
const putCancel = require('./http/put-cancel');
const getFrames = require('./http/get-frames');
const getFrame = require('./http/get-frame');
const getDownload = require('./http/get-download');

/**
 * @returns {Promise<fastify.FastifyInstance>}
 */
async function createServer() {
  const server = fastify({
    logger: {
      level: 'info',
      prettyPrint: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
    disableRequestLogging: true,
  });

  await server.register(fastifyCookie, {
    secret: crypto({ length: 32 }),
    parserOptions: {
      signed: true,
    },
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
  const downloads = createDownloads(redisDB);
  const upscaleQueue = new Bull('upscale', redisURL);
  const server = await createServer();

  server.get('/queue', getQueue(queue));

  server.route({
    method: 'PUT',
    url: '/queue',
    handler: putQueue(queue),
    schema: {
      body: {
        type: ['object', 'null'],
        properties: {
          forced: {
            type: 'boolean',
            default: false,
          },
        },
      },
    },
  });

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
    method: 'GET',
    url: '/download',
    preHandler: [createAssertQueue(queue)],
    handler: getDownload(downloads),
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
}

start();
