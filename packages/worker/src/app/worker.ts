import fs from 'fs';
import { Readable } from 'stream';
import { Worker, WorkerOptions } from 'bullmq';
import { JobStore } from '@ai-upscaler/core/src/jobs/store';
import { QueueStore } from '@ai-upscaler/core/src/queue/store';
import { createUpscaleProcessor, CreateUpscaleProcessorOptions, UpscaleJob } from '../worker/processor';
import { UpscalerEventEmitter } from '../upscaler/upscaler';
import logger from './logger';

export interface WorkerFactoryOptions extends CreateUpscaleProcessorOptions {
  queueStore: QueueStore
  jobStore: JobStore
  options: WorkerOptions

  uploadFrame: (jobId: string, frame: string, stream: Readable) => Promise<void>
  uploadEnhancedFrame: (jobId: string, frame: string, stream: Readable) => Promise<void>
  deleteFrames: (jobId: string) => Promise<void>
}

export function createWorker({
  queueStore,
  jobStore,
  options,

  uploadFrame,
  uploadEnhancedFrame,
  deleteFrames,

  createJobStorage,
  createJobEmitter,
}: WorkerFactoryOptions) {
  const storageMap = new Map();

  const upscaleWorker = new Worker(
    'upscaler',

    createUpscaleProcessor({
      async createJobStorage(job) {
        const storage = await createJobStorage(job);
        storageMap.set(job.id, storage);
        return storage;
      },

      createJobEmitter(job) {
        const jobEmitter = createJobEmitter(job) as UpscalerEventEmitter;
        const jobStorage = storageMap.get(job.id);

        // Add job listeners that will upload the raw and enhanced frames
        // to a storage so other services/servers can see it.
        //
        // This is added outside the processor because the processor
        // should only be concerned with just upscaling.
        jobEmitter
          .on('extract:progress', async ({ frames }) => {
            if (!jobStorage) {
              return;
            }

            frames.forEach((frame: string) => {
              const framePath = jobStorage.getRawFramePath(frame);
              uploadFrame(job.id, frame, fs.createReadStream(framePath));
            });
          })
          .on('enhance:progress', async ({ frames }) => {
            frames.forEach((frame: string) => {
              const framePath = jobStorage.getEnhancedFramePath(frame);
              uploadEnhancedFrame(job.id, frame, fs.createReadStream(framePath));
            });
          });

        return jobEmitter;
      },
    }),

    options,
  );

  function cleanupJob(job: UpscaleJob) {
    jobStore.delete(job.data.user);

    createJobEmitter(job).removeAllListeners();

    deleteFrames(job.id);

    // It should exist.
    // If it doesn't it should be a bug.
    // But checking to prevent app from crashing.
    if (!storageMap.has(job.id)) {
      logger.error(`Could not find storage for job ${job.id}. Cannot cleanup.`);
      return;
    }

    storageMap.get(job.id).destroy();
    storageMap.delete(job.id);
  }

  upscaleWorker
    .on('completed', (job) => {
      logger.info('Upscale complete');

      queueStore
        .markAsStatus(job.data.user, 'finished')
        .then(() => queueStore.sortWaiting());

      cleanupJob(job);
    })
    .on('failed', (job) => {
      queueStore
        .markAsStatus(job.data.user, 'failed')
        .then(() => queueStore.sortWaiting());

      cleanupJob(job);
    });

  return upscaleWorker;
}
