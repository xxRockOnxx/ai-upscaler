import fs from 'fs';
import { Readable } from 'stream';
import { Job, Worker, WorkerOptions } from 'bullmq';
import { JobStore } from '@ai-upscaler/core/src/jobs/store';
import { QueueStore } from '@ai-upscaler/core/src/queue/store';
import { createUpscaleProcessor, CreateUpscaleProcessorOptions, UpscaleJob } from '../worker/processor';

export interface WorkerFactoryOptions extends CreateUpscaleProcessorOptions {
  queueStore: QueueStore
  jobStore: JobStore
  options: WorkerOptions

  uploadFrame: (jobId: string, frame: string, stream: Readable) => Promise<void>
  uploadEnhancedFrame: (jobId: string, frame: string, stream: Readable) => Promise<void>
}

export function createWorker({
  queueStore,
  jobStore,
  options,

  uploadFrame,
  uploadEnhancedFrame,

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
        const jobEmitter = createJobEmitter(job);
        const jobStorage = storageMap.get(job.id);

        // Add job listeners that will upload the raw and enhanced frames
        // to a storage so other services/servers can see it.
        //
        // This is added outside the processor because the processor
        // should only be concerned with just upscaling.
        jobEmitter
          .on('extract:progress', async (_, frames) => {
            if (!jobStorage) {
              return;
            }

            frames.forEach((frame: string) => {
              const framePath = jobStorage.getRawFramePath(frame);
              uploadFrame(job.id, frame, fs.createReadStream(framePath));
            });
          })
          .on('enhance:progress', async (_, frames) => {
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
    jobStore.delete(job.data.id);

    createJobEmitter(job).removeAllListeners();

    // It should exist.
    // If it doesn't it should be a bug.
    // But checking to prevent app from crashing.
    if (!storageMap.has(job.id)) {
      console.error(`Could not find storage for job ${job.id}. Cannot cleanup.`);
      return;
    }

    storageMap.get(job.id).destroy();
    storageMap.delete(job.id);
  }

  upscaleWorker
    .on('completed', (job) => {
      console.log('Upscale complete');

      queueStore
        .markAsStatus(job.data.id, 'finished')
        .then(() => queueStore.sort());

      cleanupJob(job);
    })
    .on('failed', (job) => {
      console.error('Upscale failed', {
        name: job.name,
        data: job.data,
        reason: job.failedReason,
      });

      queueStore
        .markAsStatus(job.data.id, 'failed')
        .then(() => queueStore.sort());

      cleanupJob(job);
    });

  return upscaleWorker;
}
