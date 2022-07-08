import * as fs from 'fs-extra';
import { EventEmitter } from 'events';
import { extractFrames } from './extract';
import { enhanceFrames } from './enhance';
import { stitchFrames } from './stitch';
import { DeferredTask, makeTaskEmitEvents, taskEventToPromise } from './task';

export interface UpscalerPaths {
  frames(relativePath?: string): string
  enhancedFrames(relativePath?: string): string
}
interface UpscaleOption {
  input: string
  output: string
  emitter: EventEmitter
  paths: UpscalerPaths
}

export const FRAME_NAME = 'frame_%03d.png';

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

  // The next 2 functions are created simply to avoid adding the same parameters repeatedly.
  function curriedMakeTaskEmitEvents<N extends string, T, R>(task: DeferredTask<N, T, R>) {
    return makeTaskEmitEvents(emitter, task);
  }

  function curriedTaskEventToPromise(task: string) {
    return taskEventToPromise(emitter, task);
  }

  curriedMakeTaskEmitEvents({
    name: 'extract',
    callback: extractFrames,
    data: {
      input,
      output: paths.frames(FRAME_NAME),
    },
  });

  const videoDetails = await curriedTaskEventToPromise('extract') as string[];

  curriedMakeTaskEmitEvents({
    name: 'enhance',
    callback: enhanceFrames,
    data: {
      input: paths.frames(),
      output: paths.enhancedFrames(),
    },
  });

  await curriedTaskEventToPromise('enhance');

  curriedMakeTaskEmitEvents({
    name: 'stitch',
    callback: stitchFrames,
    data: {
      output,
      input: paths.enhancedFrames(FRAME_NAME),
      framerate: Number(videoDetails
        .find((detail) => detail.includes('fps'))
        .split('fps')[0]),
    },
  });

  await curriedTaskEventToPromise('stitch');
}
