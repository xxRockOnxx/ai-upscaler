import Redis from 'ioredis';
import { Worker } from 'bullmq';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as minio from 'minio';
import { EventEmitter } from 'events';
import createQueueStore from '@ai-upscaler/core/src/queue/redis';
import { FrameStorage, Storage } from '@ai-upscaler/core/src/storage/storage';
import { createStorage as createLocalStorage, LocalStorage } from '@ai-upscaler/core/src/storage/local';
import { createStorage as createMinioStorage, createFrameStorage } from '@ai-upscaler/core/src/storage/minio';
import { QueueStore } from '@ai-upscaler/core/src/queue/store';
import { upscale } from './upscaler/upscaler';
import createCancel from './channels/cancel';
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

export const DIR_FRAMES = 'frames';
export const DIR_ENHANCED_FRAMES = 'enhanced_frames';

interface WorkerOptions {
  // We define these functions as factory functions
  // because we store multiple files in these storages
  // and we want them to be scoped so we want custom storage
  // instances for each job.
  createLocalStorageForJob(id: string): Promise<LocalStorage>
  createFrameStorageForJob(id: string): FrameStorage

  // Downloads and Uploads are stored in a flat directory because
  // we only store one file so no need for factory functions.
  uploadStorage: Storage
  downloadStorage: Storage

  events: EventEmitter
  redis: Redis
  queueStore: QueueStore
}

function initializeWorker({
  uploadStorage,
  downloadStorage,

  createLocalStorageForJob,
  createFrameStorageForJob,

  events,
  redis,
  queueStore,
}: WorkerOptions) {
  const upscaleWorker = new Worker(
    'upscaler',

    async (job) => {
      function updateTaskProgress(task: string, progress: number) {
        job.updateProgress({
          ...job.progress as object,
          [task]: progress,
        });
      }

      const scopedEvents = scopeEventEmitter(events, job.id);
      const workStorage = await createLocalStorageForJob(job.id);
      const frameStorage = createFrameStorageForJob(job.id);

      // Download file to local filesystem
      const fileStream = await uploadStorage.get(job.data.input);
      const filename = uuid();
      const filenameEnhanced = `${filename}_enhanced`;
      await workStorage.store(filename, fileStream);

      // Handlers that update the job progress
      scopedEvents
        .on('extract:progress', (progress) => updateTaskProgress('extract', progress))
        .on('enhance:progress', (progress) => updateTaskProgress('enhance', progress))
        .on('stitch:progress', (progress) => updateTaskProgress('stitch', progress));

      const upscalerPaths = {
        frames(relativePath?) {
          if (relativePath) {
            return workStorage.path(path.join(DIR_FRAMES, relativePath));
          }

          return workStorage.path(DIR_FRAMES);
        },

        enhancedFrames(relativePath?) {
          if (relativePath) {
            return workStorage.path(path.join(DIR_ENHANCED_FRAMES, relativePath));
          }

          return workStorage.path(DIR_ENHANCED_FRAMES);
        },
      };

      // Handlers that will store the frames so other services/servers can access them
      scopedEvents
        .on('extract:progress', async (_, frames) => {
          frames.forEach((frame: string) => {
            const framePath = upscalerPaths.frames(frame);
            frameStorage.storeFrame(frame, fs.createReadStream(framePath), false);
          });
        })
        .on('enhance:progress', async (_, frames) => {
          frames.forEach((frame: string) => {
            const framePath = upscalerPaths.enhancedFrames(frame);
            frameStorage.storeFrame(frame, fs.createReadStream(framePath), true);
          });
        });

      // Enhance video
      await upscale({
        input: workStorage.path(filename),
        output: workStorage.path(filenameEnhanced),
        emitter: scopedEvents,
        paths: upscalerPaths,
      });

      scopedEvents.removeAllListeners();

      // Upload enhanced video.
      // Use `job.data.id` which should be a user's id instead of `job.id`
      // because we only want to store 1 file per user (at least for now).
      const enhancedFile = await workStorage.get(filenameEnhanced);
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

    // Delete both raw and enhanced frames
    createFrameStorageForJob(job.id).deleteFrames(false);
    createFrameStorageForJob(job.id).deleteFrames(true);

    // Delete the work storage
    createLocalStorageForJob(job.data.id).then((storage) => storage.destroy());
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

    // Delete both raw and enhanced frames.
    createFrameStorageForJob(job.id).deleteFrames(false);
    createFrameStorageForJob(job.id).deleteFrames(true);

    // Delete the work storage
    createLocalStorageForJob(job.data.id).then((storage) => storage.destroy());
  });
}

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
  const events = new EventEmitter();

  initializeWorker({
    uploadStorage,
    downloadStorage,

    createFrameStorageForJob: (id) => createFrameStorage(minioClient, 'frames', id),
    createLocalStorageForJob: (id) => createLocalStorage(path.join(workDir, id)),

    events,
    redis: redisDB,
    queueStore,
  });

  initializePubSub({
    subscriber: redisSub,
    cancel: createCancel(events),
  });

  console.log('Worker started');
}

start();
