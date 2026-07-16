import * as fs from 'fs-extra';
import type { EventEmitter } from 'events';
import { Processor, DEFAULT_PROCESSOR } from '@ai-upscaler/core/src/upscale/processor';
import { extractFrames } from './extract';
import { enhanceFrames, EnhanceData } from './enhance';
import { enhanceFramesWaifu2x } from './enhance-waifu2x';
import { stitchFrames } from './stitch';
import { Task } from './task';

const enhancers: Record<Processor, Task<EnhanceData, void>> = {
  'real-esrgan': enhanceFrames,
  waifu2x: enhanceFramesWaifu2x,
};

export interface UpscalerPaths {
  frames(relativePath?: string): string
  enhancedFrames(relativePath?: string): string
}

export interface UpscalerEventEmitter extends EventEmitter {
  on(event: 'extract:progress', listener: (data: { percent: number, frames: string[] }) => void): this;
  on(event: 'enhance:progress', listener: (data: { percent: number, frames: string[] }) => void): this;
  on(event: 'stitch:progress', listener: (data: { percent: number }) => void): this;

  emit(event: 'extract:progress', data: { percent: number, frames: string[] }): boolean;
  emit(event: 'enhance:progress', data: { percent: number, frames: string[] }): boolean;
  emit(event: 'stitch:progress', data: { percent: number }): boolean;
}
interface UpscaleOption {
  input: string
  output: string
  emitter: UpscalerEventEmitter
  paths: UpscalerPaths
  signal?: AbortSignal
  processor?: Processor
}

export const FRAME_NAME = 'frame_%d.png';

export async function upscale({
  input,
  output,
  emitter,
  paths,
  signal,
  processor = DEFAULT_PROCESSOR,
}: UpscaleOption) {
  const enhanceFramesWith = enhancers[processor] ?? enhancers[DEFAULT_PROCESSOR];

  await Promise.all([
    fs.emptyDir(paths.frames()),
    fs.emptyDir(paths.enhancedFrames()),
  ]);

  const videoDetails = await extractFrames({
    input,
    output: paths.frames(FRAME_NAME),
  }, {
    signal,
    onProgress: (progress) => emitter.emit('extract:progress', progress),
  });

  await enhanceFramesWith({
    input: paths.frames(),
    output: paths.enhancedFrames(),
  }, {
    signal,
    onProgress: (progress) => emitter.emit('enhance:progress', progress),
  });

  await stitchFrames({
    output,
    input: paths.enhancedFrames(FRAME_NAME),
    framerate: Number(videoDetails
      .find((detail) => detail.includes('fps'))
      .split('fps')[0]),
  }, {
    signal,
    onProgress: (progress) => emitter.emit('stitch:progress', progress),
  });
}
