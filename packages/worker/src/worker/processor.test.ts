import { EventEmitter } from 'events';
import { createUpscaleProcessor, UpscaleProcessor } from './processor';

jest
  .mock('fs')
  .mock('../upscaler/upscaler', () => ({
    upscale: jest.fn().mockResolvedValue(undefined),
  }));

describe('processor.ts', () => {
  let emitter: EventEmitter;
  let processor: UpscaleProcessor;

  beforeAll(() => {
    emitter = new EventEmitter();
    processor = createUpscaleProcessor({
      // We don't need an implementation for this because
      // we will mock the actual upscaling.
      createJobStorage: () => Promise.resolve({
        getRawVideoPath: () => '',
        getRawFramePath: (frame) => frame,
        getEnhancedFramePath: (frame) => frame,
        getEnhancedVideoPath: () => '',
        downloadRawVideo: () => Promise.resolve(),
        uploadEnhancedVideo: () => Promise.resolve(),
        destroy: () => Promise.resolve(),
      }),
      createJobEmitter: () => emitter,
    });
  });

  it('should update job progress relative to task progress', async () => {
    const job = {
      id: 1,
      data: {
        id: 'user-id',
        input: 'uploaded-video.mp4',
      },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    processor(job as any);

    // Wait for whatever needs to happen inside processor.
    // e.g setting up listeners, downloading file, calling the upscale function.
    await new Promise((resolve) => {
      process.nextTick(resolve);
    });

    emitter.emit('extract:progress', 100, []);
    emitter.emit('enhance:progress', 100, []);
    emitter.emit('stitch:progress', 100);

    expect(job.updateProgress).toBeCalledTimes(3);

    expect(job.updateProgress).toHaveBeenNthCalledWith(1, {
      extract: 100,
    });

    expect(job.updateProgress).toHaveBeenNthCalledWith(2, {
      enhance: 100,
    });

    expect(job.updateProgress).toHaveBeenNthCalledWith(3, {
      stitch: 100,
    });
  });
});
