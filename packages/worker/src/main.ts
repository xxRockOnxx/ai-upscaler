import Redis from 'ioredis';
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import * as os from 'os';
import * as minio from 'minio';
import { EventEmitter } from 'events';
import createQueueStore from '@ai-upscaler/core/src/queue/redis';
import createJobStore from '@ai-upscaler/core/src/jobs/redis';
import createDownloadStore from '@ai-upscaler/core/src/downloads/redis';
import { createStorage as createLocalStorage } from '@ai-upscaler/core/src/storage/local';
import { createStorage as createMinioStorage } from '@ai-upscaler/core/src/storage/minio';
import { createWorker } from './app/worker';
import logger from './app/logger';

const requiredEnvVariables = [
  'REDIS_HOST',
  'REDIS_PORT',

  'REAL_ESRGAN_PATH',
  'WAIFU2X_PATH',
  'ANIME4K_PATH',
  'RIFE_PATH',

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

export const DIR_RAW_FRAMES = 'raw';
export const DIR_ENHANCED_FRAMES = 'enhanced';
export const DIR_INTERPOLATED_FRAMES = 'interpolated';

interface PubSubOptions {
  subscriber: Redis
  cancel: (id: string) => void
}

async function initializePubSub({
  subscriber,
  cancel,
}: PubSubOptions) {
  await subscriber.subscribe('cancel');

  subscriber.on('message', (channel, message) => {
    let data;

    try {
      data = JSON.parse(message);
    } catch (e) {
      logger.error('Ignoring malformed pub/sub message', { channel, cause: e });
      return;
    }

    // We ignore any job that is not listed here.
    // eslint-disable-next-line default-case
    switch (channel) {
      case 'cancel': {
        cancel(data.id);
        break;
      }
    }
  });
}

async function start() {
  const redisDB = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    maxRetriesPerRequest: null,
  });

  const redisSub = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    maxRetriesPerRequest: null,
  });

  const minioClient = new minio.Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: Number(process.env.MINIO_PORT),
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    useSSL: process.env.MINIO_USE_SSL === 'true',
  });

  const queueStore = createQueueStore(redisDB);
  const jobStore = createJobStore(redisDB);
  const downloadStore = createDownloadStore(redisDB);

  const workDir = path.join(os.tmpdir(), 'ai-upscaler');
  const uploadStorage = createMinioStorage(minioClient, 'uploads');
  const downloadStorage = createMinioStorage(minioClient, 'downloads');
  const frameStorage = createMinioStorage(minioClient, 'frames');

  // One `AbortController` per active job.
  // Aborting a job's controller cancels its running tasks.
  const abortControllers = new Map<string, AbortController>();

  const worker = createWorker({
    queueStore,
    jobStore,

    createJobEmitter: () => new EventEmitter(),

    createJobSignal: (job) => {
      const controller = new AbortController();
      abortControllers.set(job.id, controller);
      return controller.signal;
    },

    async createJobStorage(job) {
      const jobStorage = await createLocalStorage(path.join(workDir, job.id));
      const filename = uuid();
      const enhancedVideoPath = jobStorage.path(filename);

      return {
        getRawVideoPath: () => jobStorage.path(job.data.user),
        getEnhancedVideoPath: () => enhancedVideoPath,
        getRawFramePath: (frame) => jobStorage.path(DIR_RAW_FRAMES, frame ?? ''),
        getEnhancedFramePath: (frame) => jobStorage.path(DIR_ENHANCED_FRAMES, frame ?? ''),
        getInterpolatedFramePath: (frame) => jobStorage.path(DIR_INTERPOLATED_FRAMES, frame ?? ''),

        // eslint-disable-next-line max-len
        downloadRawVideo: async () => jobStorage.store(job.data.user, await uploadStorage.get(job.data.user)),

        // eslint-disable-next-line max-len
        uploadEnhancedVideo: async () => {
          await Promise.all([
            downloadStorage.store(job.id, await jobStorage.get(filename)),
            downloadStore.save(job.data.user, job.id),
          ]);
        },

        destroy: jobStorage.destroy,
      };
    },

    uploadFrame: (jobId, frame, file) => frameStorage.store(path.join(jobId, 'raw', frame), file),
    uploadEnhancedFrame: (jobId, frame, file) => frameStorage.store(path.join(jobId, 'enhanced', frame), file),
    deleteFrames: (jobId) => frameStorage.delete(jobId),

    options: {
      connection: redisDB,
      sharedConnection: true,
    },
  });

  // Drop the controller once a job settles
  // so cancelling an old id becomes a no-op.
  worker
    .on('completed', (job) => {
      abortControllers.delete(job.id);
    })
    .on('failed', (job) => {
      if (job) {
        abortControllers.delete(job.id);
      }
    });

  await initializePubSub({
    subscriber: redisSub,
    cancel: (id) => abortControllers.get(id)?.abort(),
  });

  logger.info('Worker started');
}

start().catch((e) => {
  logger.error('Worker failed to start', { cause: e });

  // A failed startup can leave live Redis connections behind,
  // which would keep the event loop (and a broken worker) alive.
  // eslint-disable-next-line no-process-exit
  process.exit(1);
});
