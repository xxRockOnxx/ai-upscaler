const createClient = require('redis').createClient;
const fastify = require('fastify');
const fastifyCookie = require("@fastify/cookie");
const fastifyMultipart = require("@fastify/multipart");
const crypto = require('crypto-random-string');
const fs = require('fs').promises;
const createQueue = require('./queue')
const createJobs = require('./jobs');
const createUpscaler = require('./upscaler');
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
      prettyPrint: process.env.NODE_ENV === "production"
          ? false
          : {
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

  return server
}

function createAssertQueue(queue) {
  return async function(request, reply) {
    const queueList = await queue.getAll();

    if (!request.cookies.queue || !queueList[request.cookies.queue]) {
      reply.code(400).send("Not in queue or invalid queue id");
    }
  };
}

async function start() {
  const redisClient = createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  });

  await redisClient.connect();

  const queue = createQueue(redisClient);
  const jobs = createJobs(redisClient);
  const upscaler = createUpscaler({
    jobs,
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
    }
  })
  const server = await createServer();

  server.get('/queue', getQueue(queue));
  server.put('/queue', putQueue(queue));
  server.put('/cancel', putCancel(queue));

  server.route({
    method: "GET",
    url: "/progress",
    preHandler: [createAssertQueue(queue)],
    handler: getProgress(queue, jobs, upscaler),
  });

  server.route({
    method: "GET",
    url: "/frames",
    preHandler: [createAssertQueue(queue)],
    handler: getFrames(),
  });

  server.route({
    method: "GET",
    url: "/frame/:frame",
    preHandler: [createAssertQueue(queue)],
    handler: getFrame(),
  });

  server.route({
    method: "POST",
    url: "/submit",
    preHandler: [createAssertQueue(queue)],
    handler: postSubmit(queue, upscaler),
  });

  await server.listen(3000, '0.0.0.0')

  console.log(`Listening on http://0.0.0.0:3000`);

  upscaler.queue.upscale.on("completed", (job, result) => {
    queue
      .markAsStatus(job.data.id, "finished")
      .then(() => queue.sort());

    fs.rm(job.data.input)
  });

  upscaler.queue.upscale.on("failed", (job, err) => {
    server.log.error(err, job.data)

    queue
      .markAsStatus(job.data.id, "failed")
      .then(() => queue.sort());
  });
}

start()
