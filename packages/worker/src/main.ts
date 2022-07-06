import Redis from 'ioredis';
import { Worker } from 'bullmq';
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import * as os from 'os';
import * as minio from 'minio';
import { EventEmitter } from 'events';
import createQueueStore from '@ai-upscaler/core/src/queue/redis';
import { Storage } from '@ai-upscaler/core/src/storage/storage';
import createLocalStorage, { LocalStorage } from '@ai-upscaler/core/src/storage/local';
import createMinioStorage from '@ai-upscaler/core/src/storage/minio';
import { QueueStore } from '@ai-upscaler/core/src/queue/store';
import upscaler from './upscaler/upscaler';
import createGetFrames from './channels/get-frames';
import createGetFrame, { GetFrameRequest } from './channels/get-frame';
import createCancel from './channels/cancel';

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

interface WorkerOptions {
  workDir: string
  events: EventEmitter

  localStorage: LocalStorage
  uploadStorage: Storage
  downloadStorage: Storage

  redis: Redis
  queueStore: QueueStore
}

function initializeWorker({
  workDir,
  events,
  localStorage,
  uploadStorage,
  downloadStorage,
  redis,
  queueStore,
}: WorkerOptions) {
  const upscale = upscaler({
    workDir,
    events,
  });

  const upscaleWorker = new Worker(
    'upscaler',

    async (job) => {
      function updateTaskProgress(task: string, progress: number) {
        job.updateProgress({
          ...job.progress as object,
          [task]: progress,
        });
      }

      // Download file to local filesystem
      const fileStream = await uploadStorage.get(job.data.input);
      const filename = uuid();
      const filenameEnhanced = `${filename}_enhanced`;
      await localStorage.store(filename, fileStream);

      // Enhance video
      await new Promise((resolve, reject) => {
        const task = upscale({
          id: job.data.id,
          input: localStorage.path(filename),
          output: localStorage.path(filenameEnhanced),
        });

        task
          .on('extract:progress', (progress) => updateTaskProgress('extract', progress))
          .on('enhance:progress', (progress) => updateTaskProgress('enhance', progress))
          .on('stitch:progress', (progress) => updateTaskProgress('stitch', progress))
          .once('done', resolve)
          .once('error', reject);
      });

      // Upload enhanced video
      const enhancedFile = await localStorage.get(filenameEnhanced);
      await downloadStorage.store(job.data.id, enhancedFile);
    },

    {
      connection: redis,
    },
  );

  upscaleWorker.on('completed', (job) => {
    console.log('Upscale complete');

    queueStore
      .markAsStatus(job.data.id, 'finished')
      .then(() => queueStore.sort());

    // Video is enhanced. No need to keep the raw video.
    uploadStorage.delete(job.data.input);
  });

  upscaleWorker.on('failed', (job) => {
    console.error('Upscale failed', {
      name: job.name,
      data: job.data,
      reason: job.failedReason,
    });

    queueStore
      .markAsStatus(job.data.id, 'failed')
      .then(() => queueStore.sort());

    // We currently do not support job retry.
    // No need to keep the raw video.
    uploadStorage.delete(job.data.input);
  });
}

interface PubSubOptions {
  publisher: Redis
  subscriber: Redis

  getFrames: (id: string) => Promise<string[]>
  getFrame: (payload: GetFrameRequest) => Promise<ReturnType<Buffer['toJSON']>>
  cancel: (id: string) => void
}

async function initializePubSub({
  publisher,
  subscriber,
  getFrames,
  getFrame,
  cancel,
}: PubSubOptions) {
  await subscriber.subscribe('getFrames', 'getFrame', 'cancel');

  subscriber.on('message', async (channel, message) => {
    const data = JSON.parse(message);

    // We ignore any job that is not listed here.
    // eslint-disable-next-line default-case
    switch (channel) {
      case 'getFrames': {
        publisher.publish('getFrames:response', JSON.stringify({
          id: data.id,
          frames: await getFrames(data.id),
        }));

        break;
      }

      case 'getFrame': {
        publisher.publish('getFrame:response', JSON.stringify({
          id: data.id,
          frame: data.frame,
          enhanced: data.enhanced,
          data: await getFrame({
            id: data.id,
            frame: data.frame,
            enhanced: data.enhanced,
          }),
        }));

        break;
      }

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
  const localStorage = await createLocalStorage(workDir);
  const uploadStorage = createMinioStorage(minioClient, 'uploads');
  const downloadStorage = createMinioStorage(minioClient, 'downloads');
  const events = new EventEmitter();

  initializeWorker({
    workDir,
    events,
    localStorage,
    uploadStorage,
    downloadStorage,
    redis: redisDB,
    queueStore,
  });

  initializePubSub({
    publisher: redisDB,
    subscriber: redisSub,

    getFrames: createGetFrames(localStorage),
    getFrame: createGetFrame(localStorage),
    cancel: createCancel(events),
  });

  console.log('Worker started');
}

start();
