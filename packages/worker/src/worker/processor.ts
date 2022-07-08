import { Job, Processor } from 'bullmq';
import { EventEmitter } from 'events';
import { upscale } from '../upscaler/upscaler';

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

export interface UpscaleJob {
  id: string
  input: string
}

export type UpscaleProcessor = Processor<UpscaleJob, void, 'upscale'>;

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
    const emitter = createJobEmitter(job);

    emitter
      .on('extract:progress', (progress) => updateTaskProgress('extract', progress))
      .on('enhance:progress', (progress) => updateTaskProgress('enhance', progress))
      .on('stitch:progress', (progress) => updateTaskProgress('stitch', progress));

    await jobStorage.downloadRawVideo();

    await upscale({
      emitter,
      input: jobStorage.getRawVideoPath(),
      output: jobStorage.getEnhancedVideoPath(),
      paths: {
        frames: jobStorage.getRawFramePath,
        enhancedFrames: jobStorage.getEnhancedFramePath,
      },
    });

    await jobStorage.uploadEnhancedVideo();
  };
}
