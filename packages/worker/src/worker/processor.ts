import { Job, Processor } from 'bullmq';
import { EventEmitter } from 'events';
import { upscale, UpscalerEventEmitter } from '../upscaler/upscaler';
import logger from '../app/logger';

export interface UpscaleJobStorage {
  getRawVideoPath(): string
  getEnhancedVideoPath(): string
  getRawFramePath(frame?: string): string
  getEnhancedFramePath(frame?: string): string

  downloadRawVideo(): Promise<void>
  uploadEnhancedVideo(): Promise<void>

  destroy(): Promise<void>
}

export interface CreateUpscaleProcessorOptions {
  createJobStorage: (job: Job) => Promise<UpscaleJobStorage>

  // A function that a caller can use to return an existing `EventEmitter` instance.
  // A reference to an existing `EventEmitter` instance can be used for cancelling.
  createJobEmitter: (job: Job) => EventEmitter
}

export interface UpscalePayload {
  user: string
}

export type UpscaleProcessor = Processor<UpscalePayload, void, 'upscale'>;

export type UpscaleJob = Parameters<UpscaleProcessor>[0]

export function createUpscaleProcessor({
  createJobStorage,
  createJobEmitter,
}: CreateUpscaleProcessorOptions): UpscaleProcessor {
  return async function upscaleProcessor(job) {
    function updateTaskProgress(task: string, progress: number) {
      job.updateProgress({
        ...job.progress as object,
        [task]: progress,
      });
    }

    const jobStorage = await createJobStorage(job);
    const emitter = createJobEmitter(job) as UpscalerEventEmitter;

    emitter
      .on('extract:progress', ({ percent }) => updateTaskProgress('extract', percent))
      .on('enhance:progress', ({ percent }) => updateTaskProgress('enhance', percent))
      .on('stitch:progress', ({ percent }) => updateTaskProgress('stitch', percent));

    try {
      await jobStorage.downloadRawVideo();
    } catch (e) {
      logger.error('Failed to download raw video', { cause: e });
      throw new Error('Failed to download raw video', { cause: e });
    }

    try {
      await upscale({
        emitter,
        input: jobStorage.getRawVideoPath(),
        output: jobStorage.getEnhancedVideoPath(),
        paths: {
          frames: jobStorage.getRawFramePath,
          enhancedFrames: jobStorage.getEnhancedFramePath,
        },
      });
    } catch (e) {
      logger.error('Failed to upscale video', { cause: e });
      throw new Error('Failed to upscale video', { cause: e });
    }

    try {
      await jobStorage.uploadEnhancedVideo();
    } catch (e) {
      logger.error('Failed to upload enhanced video', { cause: e });
      throw new Error('Failed to upload enhanced video', { cause: e });
    }
  };
}
