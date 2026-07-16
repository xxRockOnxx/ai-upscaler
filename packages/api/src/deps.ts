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

export async function createDependencies() {
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

  return {
    redisDB,
    minioClient,

    // Store / DB
    queue: createQueueStore(redisDB),
    jobs: createJobsStore(redisDB),
    downloads: createDownloadStore(redisDB),

    // Storages
    uploadStorage: createMinioStorage(minioClient, 'uploads'),
    downloadStorage: createMinioStorage(minioClient, 'downloads'),
    tmpStorage: await createLocalStorage(path.join(os.tmpdir(), 'ai-upscaler')),

    upscaleQueue: new Queue('upscaler', {
      connection: redisDB,
    }),
  };
}

export type Dependencies = Awaited<ReturnType<typeof createDependencies>>;
