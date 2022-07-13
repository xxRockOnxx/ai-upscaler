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

  once(event: 'cancel', listener: () => void): this;

  emit(event: 'extract:progress', data: { percent: number, frames: string[] }): boolean;
  emit(event: 'enhance:progress', data: { percent: number, frames: string[] }): boolean;
  emit(event: 'stitch:progress', data: { percent: number }): boolean;
  emit(event: 'cancel'): boolean;
}
interface UpscaleOption {
  input: string
  output: string
  emitter: UpscalerEventEmitter
  paths: UpscalerPaths
}

export const FRAME_NAME = 'frame_%d.png';

export async function upscale({
  input,
  output,
  emitter,
  paths,
}: UpscaleOption) {
  await Promise.all([
    fs.emptyDir(paths.frames()),
    fs.emptyDir(paths.enhancedFrames()),
  ]);

  const extract = extractFrames({
    input,
    output: paths.frames(FRAME_NAME),
  });

  let cancelListener = () => extract.emit('cancel');

  const videoDetails = await new Promise<string[]>((resolve, reject) => {
    extract
      .on('progress', (progress) => {
        emitter.emit('extract:progress', progress);
      })
      .once('done', resolve)
      .once('error', reject)
      .once('cancel', () => reject(new Error('Extract cancelled')));
  })
    .finally(() => {
      emitter.off('cancel', cancelListener);
    });

  const enhance = enhanceFrames({
    input: paths.frames(),
    output: paths.enhancedFrames(),
  });

  cancelListener = () => enhance.emit('cancel');

  emitter.once('cancel', cancelListener);

  await new Promise((resolve, reject) => {
    enhance
      .on('progress', (progress) => {
        emitter.emit('enhance:progress', progress);
      })
      .once('done', resolve)
      .once('error', reject)
      .once('cancelled', () => reject(new Error('Enhance cancelled')));
  })
    .finally(() => {
      emitter.off('cancel', cancelListener);
    });

  const stitch = stitchFrames({
    output,
    input: paths.enhancedFrames(FRAME_NAME),
    framerate: Number(videoDetails
      .find((detail) => detail.includes('fps'))
      .split('fps')[0]),
  });

  cancelListener = () => stitch.emit('cancel');

  await new Promise((resolve, reject) => {
    stitch
      .on('progress', (progress) => {
        emitter.emit('stitch:progress', progress);
      })
      .once('done', resolve)
      .once('error', reject)
      .once('cancelled', () => reject(new Error('Stitch cancelled')));
  })
    .finally(() => {
      emitter.off('cancel', cancelListener);
    });
}
