import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { preHandlerAsyncHookHandler } from 'fastify';
import * as minio from 'minio';
import * as os from 'os';
import * as path from 'path';
import createQueueStore from '@ai-upscaler/core/src/queue/redis';
import createJobsStore from '@ai-upscaler/core/src/jobs/redis';
import { QueueStore } from '@ai-upscaler/core/src/queue/store';
import { createStorage as createLocalStorage } from '@ai-upscaler/core/src/storage/local';
import { createStorage as createMinioStorage, createFrameStorage } from '@ai-upscaler/core/src/storage/minio';
import createServer from './server';
import getQueue from './http/get-queue';
import getAvailability from './http/get-availability';
import getProgress from './http/get-progress';
import putQueue from './http/put-queue';
import postSubmit from './http/post-submit';
import putCancel from './http/put-cancel';
import getFrame from './http/get-frame';
import getFrames from './http/get-frames';
import getDownload from './http/get-download';

const requiredEnvVariables = [
  'APP_SECRET',

  'REDIS_HOST',
  'REDIS_PORT',

  'MINIO_ENDPOINT',
  'MINIO_PORT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
];

// eslint-disable-next-line no-restricted-syntax
for (const variable of requiredEnvVariables) {
  if (!process.env[variable]) {
    throw new Error(`missing \`${variable}\` env variable`);
  }
}

function createAssertQueue(queue: QueueStore): preHandlerAsyncHookHandler {
  return async function assertQueue(request, reply) {
    const queueList = await queue.getAll();

    if (!request.cookies.queue || !queueList[request.cookies.queue]) {
      reply.code(400).send('Not in queue or invalid queue id');
    }
  };
}

async function start() {
  // This will be used for saving data in Stores
  const redisDB = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  });

  const redisSub = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    maxRetriesPerRequest: null,
  });

  await redisSub.subscribe('getFrames:response', 'getFrame:response');

  const minioClient = new minio.Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: Number(process.env.MINIO_PORT),
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    useSSL: process.env.MINIO_USE_SSL === 'true',
  });

  const queue = createQueueStore(redisDB);
  const jobs = createJobsStore(redisDB);

  const uploadStorage = createMinioStorage(minioClient, 'uploads');
  const downloadStorage = createMinioStorage(minioClient, 'downloads');
  const tmpStorage = await createLocalStorage(path.join(os.tmpdir(), 'ai-upscaler'));

  const upscaleQueue = new Queue('upscaler', {
    connection: redisDB,
  });

  const server = await createServer();

  server.get('/queue', getQueue(queue));

  server.get('/availability', getAvailability({
    queue: upscaleQueue,
  }));

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
    handler: getProgress({
      bull: upscaleQueue,
      queue,
      jobs,
    }),
  });

  server.route({
    method: 'GET',
    url: '/frames',
    preHandler: [createAssertQueue(queue)],
    handler: getFrames({
      jobs,
      createStorage: (id) => createFrameStorage(minioClient, 'frames', id),
    }),
  });

  server.route({
    method: 'GET',
    url: '/frame/:frame',
    preHandler: [createAssertQueue(queue)],
    handler: getFrame({
      jobs,
      createStorage: (id) => createFrameStorage(minioClient, 'frames', id),
    }),
  });

  server.route({
    method: 'GET',
    url: '/download',
    preHandler: [createAssertQueue(queue)],
    handler: getDownload({
      jobs,
      downloads: downloadStorage,
    }),
  });

  server.route({
    method: 'POST',
    url: '/submit',
    preHandler: [createAssertQueue(queue)],
    handler: postSubmit({
      bull: upscaleQueue,
      queue,
      jobs,
      tmpStorage,
      uploadStorage,
    }),
  });

  server.route({
    method: 'PUT',
    url: '/cancel',
    preHandler: [createAssertQueue(queue)],
    handler: putCancel({
      publish: redisDB,
      jobs,
      queue,
    }),
  });

  await server.listen(3000, '0.0.0.0');
}

start();
