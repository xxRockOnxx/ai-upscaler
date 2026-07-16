import * as fs from 'fs-extra';
import type { EventEmitter } from 'events';
import { extractFrames } from './extract';
import { enhanceFrames } from './enhance';
import { stitchFrames } from './stitch';

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
}

export const FRAME_NAME = 'frame_%d.png';

export async function upscale({
  input,
  output,
  emitter,
  paths,
  signal,
}: UpscaleOption) {
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

  await enhanceFrames({
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
