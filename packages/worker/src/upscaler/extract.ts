import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import difference from 'lodash.difference';
import { Task } from './task';

export interface ExtractData {
  input: string
  output: string
}

export const extractFrames: Task<ExtractData, string[]> = function extractFrames(data) {
  let details;
  let cancelled = false;
  let frames = [];
  const dirPath = path.dirname(data.output);
  const emitter = new EventEmitter();

  // Manually read the directory to get the frames
  // and compute the differences to get the new frames.
  async function getNewFrames() {
    const newFrames = await fs.readdir(dirPath);
    const returnvalue = difference(newFrames, frames);
    frames = newFrames;
    return returnvalue;
  }

  const command = ffmpeg(data.input)
    .output(data.output)
    .outputOptions([
      '-qscale:v 1',
      '-qmin 1',
      '-qmax 1',
      '-vsync passthrough',
    ])
    // eslint-disable-next-line camelcase
    .on('codecData', ({ video_details }) => {
      // eslint-disable-next-line camelcase
      details = video_details;
    })
    .on('progress', async ({ percent }) => {
      emitter.emit('progress', {
        percent,
        frames: await getNewFrames(),
      });
    })
    .on('end', async () => {
      // Sometimes ffmpeg wouldn't be able to report for 100% progress
      // because it'll trigger the `end` event first
      emitter.emit('progress', {
        percent: 100,
        frames: await getNewFrames(),
      });

      emitter.emit('done', details);
    })
    .on('error', (err) => {
      if (cancelled) {
        emitter.emit('cancelled');
      } else {
        emitter.emit('error', err);
      }
    });

  command.run();

  emitter.once('cancel', () => {
    cancelled = true;
    command.kill('SIGKILL');
  });

  return emitter;
};
