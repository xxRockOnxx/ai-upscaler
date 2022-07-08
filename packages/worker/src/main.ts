import Redis from 'ioredis';
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import * as os from 'os';
import * as minio from 'minio';
import { EventEmitter } from 'events';
import createQueueStore from '@ai-upscaler/core/src/queue/redis';
import { createStorage as createLocalStorage } from '@ai-upscaler/core/src/storage/local';
import { createStorage as createMinioStorage } from '@ai-upscaler/core/src/storage/minio';
import createCancel from './channels/cancel';
import { createWorker } from './app/worker';
import { scopeEventEmitter } from './events';

const requiredEnvVariables = [
  'REDIS_HOST',
  'REDIS_PORT',

  'REAL_ESRGAN_PATH',

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
    const data = JSON.parse(message);

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
  const workDir = path.join(os.tmpdir(), 'ai-upscaler');
  const uploadStorage = createMinioStorage(minioClient, 'uploads');
  const downloadStorage = createMinioStorage(minioClient, 'downloads');
  const frameStorage = createMinioStorage(minioClient, 'frames');
  const events = new EventEmitter();

  createWorker({
    queueStore,

    createJobEmitter: (job) => scopeEventEmitter(events, job.id),

    async createJobStorage(job) {
      const jobStorage = await createLocalStorage(path.join(workDir, job.id));
      const enhancedVideoPath = jobStorage.path(uuid());

      return {
        getRawVideoPath: () => jobStorage.path(job.data.input),
        getEnhancedVideoPath: () => enhancedVideoPath,
        getRawFramePath: (frame) => jobStorage.path(DIR_RAW_FRAMES, frame ?? ''),
        getEnhancedFramePath: (frame) => jobStorage.path(DIR_ENHANCED_FRAMES, frame ?? ''),

        // eslint-disable-next-line max-len
        downloadRawVideo: async () => jobStorage.store(job.data.input, await uploadStorage.get(job.data.input)),

        // eslint-disable-next-line max-len
        uploadEnhancedVideo: async () => downloadStorage.store(job.id, await jobStorage.get(enhancedVideoPath)),

        destroy: jobStorage.destroy,
      };
    },

    uploadFrame: (jobId, frame, file) => frameStorage.store(path.join(jobId, 'raw', frame), file),
    uploadEnhancedFrame: (jobId, frame, file) => frameStorage.store(path.join(jobId, 'enhanced', frame), file),

    options: {
      connection: redisDB,
      sharedConnection: true,
    },
  });

  initializePubSub({
    subscriber: redisSub,
    cancel: createCancel(events),
  });

  console.log('Worker started');
}

start();
