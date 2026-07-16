import { Job, Processor } from 'bullmq';
import { EventEmitter } from 'events';
import { Processor as UpscaleProcessorName } from '@ai-upscaler/core/src/upscale/processor';
import { Interpolation } from '@ai-upscaler/core/src/upscale/interpolation';
import { upscale, UpscalerEventEmitter } from '../upscaler/upscaler';
import logger from '../app/logger';

export interface UpscaleJobStorage {
  getRawVideoPath(): string
  getEnhancedVideoPath(): string
  getRawFramePath(frame?: string): string
  getEnhancedFramePath(frame?: string): string
  getInterpolatedFramePath(frame?: string): string

  downloadRawVideo(): Promise<void>
  uploadEnhancedVideo(): Promise<void>

  destroy(): Promise<void>
}

export interface CreateUpscaleProcessorOptions {
  createJobStorage: (job: Job) => Promise<UpscaleJobStorage>

  // A function that a caller can use to provide an emitter
  // for observing the job's progress.
  createJobEmitter: (job: Job) => EventEmitter

  // A function that a caller can use to provide an `AbortSignal`
  // for cancelling the job.
  createJobSignal: (job: Job) => AbortSignal
}

export interface UpscalePayload {
  user: string
  processor?: UpscaleProcessorName
  interpolation?: Interpolation
}

export type UpscaleProcessor = Processor<UpscalePayload, void, 'upscale'>;

export type UpscaleJob = Parameters<UpscaleProcessor>[0]

export function createUpscaleProcessor({
  createJobStorage,
  createJobEmitter,
  createJobSignal,
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
    const signal = createJobSignal(job);

    emitter
      .on('extract:progress', ({ percent }) => updateTaskProgress('extract', percent))
      .on('enhance:progress', ({ percent }) => updateTaskProgress('enhance', percent))
      .on('stitch:progress', ({ percent }) => updateTaskProgress('stitch', percent));

    if (job.data.interpolation && job.data.interpolation !== 'none') {
      emitter.on('interpolate:progress', ({ percent }) => updateTaskProgress('interpolate', percent));
    }

    try {
      await jobStorage.downloadRawVideo();
    } catch (e) {
      logger.error('Failed to download raw video', { cause: e });
      throw new Error('Failed to download raw video', { cause: e });
    }

    try {
      await upscale({
        emitter,
        signal,
        processor: job.data.processor,
        interpolation: job.data.interpolation,
        input: jobStorage.getRawVideoPath(),
        output: jobStorage.getEnhancedVideoPath(),
        paths: {
          frames: jobStorage.getRawFramePath,
          enhancedFrames: jobStorage.getEnhancedFramePath,
          interpolatedFrames: jobStorage.getInterpolatedFramePath,
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
