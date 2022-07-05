import * as fs from 'fs-extra';
import * as path from 'path';
import { EventEmitter } from 'events';
import { Task } from './task';
import { extractFrames } from './extract';
import { enhanceFrames } from './enhance';
import { stitchFrames } from './stitch';
import scopeEventEmitter from '../events';

interface UpscalerOptions {
  workDir: string
  events: EventEmitter
}

interface UpscaleOption {
  id: string
  input: string
  output: string
}

interface TaskPromise<T, R> {
  name: string
  data: T
  callback: Task<T, R>
}

export const DIR_FRAMES = 'frames';
export const DIR_ENHANCED_FRAMES = 'enhanced_frames';
export const FRAME_NAME = 'frame_%03d.png';

function createPromiseMaker(events: EventEmitter) {
  return function createPromise<T, R>({ name, data, callback }: TaskPromise<T, R>) {
    return new Promise<R>((resolve, reject) => {
      let cancelled = false;
      let cancelFn;

      function cancelListener() {
        cancelled = true;
        cancelFn();
      }

      cancelFn = callback({
        data,

        onDone(value) {
          resolve(value);
          events.off('cancel', cancelListener);
        },

        onError(error) {
          reject(cancelled ? new Error('Job cancelled by user') : error);
          events.off('cancel', cancelListener);
        },

        onProgress(progress) {
          events.emit(`${name}:progress`, progress);
        },
      });

      events.once('cancel', cancelListener);
    });
  };
}

export default function createUpscaler({ workDir, events }: UpscalerOptions) {
  return function upscale({ id, input, output }: UpscaleOption) {
    const scopedEvents = scopeEventEmitter(events, id);
    const promiseMaker = createPromiseMaker(scopedEvents);

    const dirFrames = path.join(workDir, id, DIR_FRAMES);
    const dirEnhanced = path.join(workDir, id, DIR_ENHANCED_FRAMES);

    let videoDetails: string[];

    Promise.all([
      fs.emptyDir(dirFrames),
      fs.emptyDir(dirEnhanced),
    ])
      .then(() => promiseMaker({
        name: 'extract',
        callback: extractFrames,
        data: {
          input,
          output: path.join(dirFrames, FRAME_NAME),
        },
      }))
      .then((videoDetails2) => {
        videoDetails = videoDetails2;
      })
      .then(() => promiseMaker({
        name: 'enhance',
        callback: enhanceFrames,
        data: {
          input: dirFrames,
          output: dirEnhanced,
        },
      }))
      .then(() => promiseMaker({
        name: 'stitch',
        callback: stitchFrames,
        data: {
          output,
          input: path.join(dirEnhanced, FRAME_NAME),
          framerate: Number(videoDetails
            .find((detail) => detail.includes('fps'))
            .split('fps')[0]),
        },
      }))
      .then(
        () => scopedEvents.emit('done'),
        (error) => scopedEvents.emit('error', error),
      );

    return scopedEvents;
  };
}
