import Redis from 'ioredis';
import { Worker } from 'bullmq';
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import * as os from 'os';
import * as minio from 'minio';
import * as fs from 'fs-extra';
import concat from 'concat-stream';
import { EventEmitter } from 'events';
import createQueueStore from '@ai-upscaler/core/src/queue/redis';
import createLocalStorage from '@ai-upscaler/core/src/storage/local';
import createMinioStorage from '@ai-upscaler/core/src/storage/minio';
import upscaler, { DIR_ENHANCED_FRAMES, DIR_FRAMES } from './upscaler/upscaler';
import scopeEventEmitter from './events';

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

async function start() {
  const redisDB = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  });

  const redisQueue = new Redis({
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

  const workDir = path.join(os.tmpdir(), 'ai-upscaler');
  const localStorage = await createLocalStorage(workDir);
  const uploadStorage = createMinioStorage(minioClient, 'uploads');
  const downloadStorage = createMinioStorage(minioClient, 'downloads');

  const events = new EventEmitter();

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
          input: path.join(workDir, filename),
          output: path.join(workDir, filenameEnhanced),
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
      connection: redisQueue,
    },
  );

  const commandWorker = new Worker(
    'command',

    // eslint-disable-next-line consistent-return
    async (job) => {
      // We ignore any job that is not listed here.
      // eslint-disable-next-line default-case
      switch (job.name) {
        case 'getFrames': {
          return fs.readdir(localStorage.path(path.join(job.data.id, DIR_ENHANCED_FRAMES)));
        }

        case 'getFrame': {
          const dir = job.data.enhanced
            ? DIR_ENHANCED_FRAMES
            : DIR_FRAMES;

          return localStorage
            .get(path.join(job.data.id, dir, job.data.frame))
            .then((stream) => new Promise((resolve, reject) => {
              stream
                .on('error', reject)
                .pipe(concat((data) => resolve(data)));
            }));
        }

        case 'cancel': {
          const scopedEvents = scopeEventEmitter(events, job.data.id);
          scopedEvents.emit('cancel');
          break;
        }
      }
    },

    {
      connection: redisQueue,
      concurrency: 3,
    },
  );

  const queueStore = createQueueStore(redisDB);

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

  commandWorker.on('failed', (job) => {
    console.error('Command failed', {
      name: job.name,
      data: job.data,
      reason: job.failedReason,
    });
  });

  console.log('Worker started');
}

start();
