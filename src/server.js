const createClient = require('redis').createClient;
const fastify = require('fastify');
const fastifyCookie = require("@fastify/cookie");
const fastifyMultipart = require("@fastify/multipart");
const crypto = require('crypto-random-string');
const createQueue = require('./queue')
const createJobs = require('./jobs');
const createUpscaler = require('./upscaler');
const Storage = require('./storage')
const getQueue = require('./http/get-queue');
const postQueue = require('./http/post-queue');
const postSubmit = require('./http/post-submit');
const getProgress = require('./http/get-progress');

async function createServer() {
  const server = fastify({
    logger: {
      level: 'error',
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

  server.get('/', async (request, reply) => {
    reply.send("HI")
  });

  server.get('/queue', getQueue(queue));
  server.post('/queue', postQueue(queue));

  server.route({
    method: "GET",
    url: "/progress",
    preHandler: [createAssertQueue(queue)],
    handler: getProgress(queue, jobs, upscaler),
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
    queue.upsert(job.data.id, {
      status: "finished",
      updatedAt: new Date(),
    });
  })

  upscaler.queue.upscale.on("failed", (job, err) => {
    queue.upsert(job.data.id, {
      status: "failed",
      updatedAt: new Date(),
    });
  })

  setInterval(() => {
    console.log("[Task] Running cleanup");
    queue.removeExpired().then((expired) => {
      console.log(`[Task] Removed ${expired.length} expired queue`);
      console.log("[Task] Removing expired working directories");
      expired.forEach((id) => {
        Storage.delete(id).catch((e) => {
          // The directory might not have existed yet
        })
      });
    })
  }, 1000 * 60);
}

start()
