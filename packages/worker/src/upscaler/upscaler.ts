import * as fs from 'fs-extra';
import type { EventEmitter } from 'events';
import { Processor, DEFAULT_PROCESSOR } from '@ai-upscaler/core/src/upscale/processor';
import { Interpolation, DEFAULT_INTERPOLATION } from '@ai-upscaler/core/src/upscale/interpolation';
import { extractFrames } from './extract';
import { enhanceFrames, EnhanceData } from './enhance';
import { enhanceFramesWaifu2x } from './enhance-waifu2x';
import { enhanceFramesAnime4k } from './enhance-anime4k';
import { interpolateFrames, InterpolateData } from './interpolate';
import { interpolateFramesCain } from './interpolate-cain';
import { stitchFrames } from './stitch';
import { Task } from './task';

const enhancers: Record<Processor, Task<EnhanceData, void>> = {
  'real-esrgan': enhanceFrames,
  waifu2x: enhanceFramesWaifu2x,
  anime4k: enhanceFramesAnime4k,
};

const interpolators: Record<Exclude<Interpolation, 'none'>, Task<InterpolateData, void>> = {
  rife: interpolateFrames,
  cain: interpolateFramesCain,
};

export interface UpscalerPaths {
  frames(relativePath?: string): string
  enhancedFrames(relativePath?: string): string
  interpolatedFrames(relativePath?: string): string
}

export interface UpscalerEventEmitter extends EventEmitter {
  on(event: 'extract:progress', listener: (data: { percent: number, frames: string[] }) => void): this;
  on(event: 'enhance:progress', listener: (data: { percent: number, frames: string[] }) => void): this;
  on(event: 'interpolate:progress', listener: (data: { percent: number, frames: string[] }) => void): this;
  on(event: 'stitch:progress', listener: (data: { percent: number }) => void): this;

  emit(event: 'extract:progress', data: { percent: number, frames: string[] }): boolean;
  emit(event: 'enhance:progress', data: { percent: number, frames: string[] }): boolean;
  emit(event: 'interpolate:progress', data: { percent: number, frames: string[] }): boolean;
  emit(event: 'stitch:progress', data: { percent: number }): boolean;
}
interface UpscaleOption {
  input: string
  output: string
  emitter: UpscalerEventEmitter
  paths: UpscalerPaths
  signal?: AbortSignal
  processor?: Processor
  interpolation?: Interpolation
}

export const FRAME_NAME = 'frame_%d.png';

export async function upscale({
  input,
  output,
  emitter,
  paths,
  signal,
  processor = DEFAULT_PROCESSOR,
  interpolation = DEFAULT_INTERPOLATION,
}: UpscaleOption) {
  const enhanceFramesWith = enhancers[processor] ?? enhancers[DEFAULT_PROCESSOR];
  const interpolateFramesWith = interpolation === 'none'
    ? undefined
    : interpolators[interpolation];

  await Promise.all([
    fs.emptyDir(paths.frames()),
    fs.emptyDir(paths.enhancedFrames()),
    fs.emptyDir(paths.interpolatedFrames()),
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

  const framerate = Number(videoDetails
    .find((detail) => detail.includes('fps'))
    .split('fps')[0]);

  let stitchInput = paths.enhancedFrames(FRAME_NAME);
  let stitchFramerate = framerate;

  if (interpolateFramesWith) {
    // `extractFrames` returns video metadata, not a frame list, so count
    // the enhanced frames on disk for the interpolator's progress total
    // (and rife's `-n`).
    const frameCount = (await fs.readdir(paths.enhancedFrames())).length;

    await interpolateFramesWith({
      input: paths.enhancedFrames(),
      output: paths.interpolatedFrames(),
      frameCount,
      frameName: FRAME_NAME,
    }, {
      signal,
      onProgress: (progress) => emitter.emit('interpolate:progress', progress),
    });

    // Doubling the frame count doubles the framerate,
    // keeping the video's duration unchanged.
    stitchInput = paths.interpolatedFrames(FRAME_NAME);
    stitchFramerate = framerate * 2;
  }

  await stitchFrames({
    output,
    input: stitchInput,
    framerate: stitchFramerate,
  }, {
    signal,
    onProgress: (progress) => emitter.emit('stitch:progress', progress),
  });
}
