import Redis from 'ioredis';
import { Queue } from 'bullmq';
import * as minio from 'minio';
import * as os from 'os';
import * as path from 'path';
import createQueueStore from '@ai-upscaler/core/src/queue/redis';
import createJobsStore from '@ai-upscaler/core/src/jobs/redis';
import createDownloadStore from '@ai-upscaler/core/src/downloads/redis';
import { createStorage as createLocalStorage } from '@ai-upscaler/core/src/storage/local';
import { createStorage as createMinioStorage } from '@ai-upscaler/core/src/storage/minio';
import { createAssertQueue } from './http/prehandlers/assert-queue';
import { createAssertJob } from './http/prehandlers/assert-job';
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

async function start() {
  // This will be used for saving data in Stores
  const redisDB = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  });

  const minioClient = new minio.Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: Number(process.env.MINIO_PORT),
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    useSSL: process.env.MINIO_USE_SSL === 'true',
  });

  // Store / DB
  const queue = createQueueStore(redisDB);
  const jobs = createJobsStore(redisDB);
  const downloads = createDownloadStore(redisDB);

  // Storages
  const uploadStorage = createMinioStorage(minioClient, 'uploads');
  const downloadStorage = createMinioStorage(minioClient, 'downloads');
  const tmpStorage = await createLocalStorage(path.join(os.tmpdir(), 'ai-upscaler'));

  const upscaleQueue = new Queue('upscaler', {
    connection: redisDB,
  });

  const server = await createServer();

  server
    .get('/availability', getAvailability({ queue: upscaleQueue }))
    .get('/queue', getQueue({ queue, jobs }))
    .put('/queue', putQueue({
      queue,
      cancelJob: (id) => {
        jobs
          .get(id)
          .then((job) => redisDB.publish('cancel', JSON.stringify({ id: job })));
      },
    }));

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

  // We allow fetching of progress by a specific job
  // instead of automatically getting the current job
  // like the other routes because when a job is completed,
  // the user's current job will be cleared from the store.
  // The UI won't be able to see the finished progress because of this.
  server.route({
    method: 'GET',
    url: '/jobs/:job/progress',
    preHandler: [createAssertQueue(queue)],
    handler: getProgress({
      bull: upscaleQueue,
    }),
  });

  server.route({
    method: 'GET',
    url: '/download',
    preHandler: [createAssertQueue(queue)],
    handler: getDownload({
      async getDownloadFile(id) {
        const jobId = await jobs.get(id);

        // No current job is being processed.
        // Return the last saved file.
        if (!jobId) {
          const downloadId = await downloads.get(id);
          return downloadStorage.get(downloadId);
        }

        // We only allow 1 file to be saved for each user/queue/cookie.
        return undefined;
      },
    }),
  });

  // Routes that are related to the current job of this request/user/queue
  server
    .route({
      method: 'GET',
      url: '/frames',
      preHandler: [
        createAssertQueue(queue),
        createAssertJob(jobs),
      ],
      handler: getFrames({
        async getFramesProcessed(id) {
          const jobId = await jobs.get(id);
          let count = 0;

          return new Promise((resolve, reject) => {
            minioClient
              .listObjects('frames', `${jobId}/enhanced`, true)
              .on('data', () => {
                count += 1;
              })
              .once('end', () => resolve(count))
              .once('error', reject);
          });
        },
      }),
    })
    .route({
      method: 'GET',
      url: '/frames/:frame',
      preHandler: [
        createAssertQueue(queue),
        createAssertJob(jobs),
      ],
      handler: getFrame({
        async getFrameStream(id, frame, enhanced) {
          const jobId = await jobs.get(id);
          const directory = enhanced ? 'enhanced' : 'raw';
          return minioClient
            .getObject('frames', `${jobId}/${directory}/frame_${frame}.png`)
            .catch((e) => {
              if (e.code === 'NoSuchKey') {
                return undefined;
              }
              throw e;
            });
        },
      }),
    })
    .route({
      method: 'PUT',
      url: '/cancel',
      preHandler: [
        createAssertQueue(queue),
        createAssertJob(jobs),
      ],
      handler: putCancel({
        publish: redisDB,
        jobs,
        queue,
      }),
    });

  queue.removeExpired();

  await server.listen(3000, '0.0.0.0');
}

start();
