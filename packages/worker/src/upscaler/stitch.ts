import ffmpeg from 'fluent-ffmpeg';
import { EventEmitter } from 'events';
import { Task } from './task';

export interface StitchData {
  input: string
  output: string
  framerate: number
}

export const stitchFrames: Task<StitchData, void> = function stitchFrames({
  input,
  output,
  framerate,
}) {
  let cancelled = false;
  const emitter = new EventEmitter();

  const command = ffmpeg(input)
    .inputFps(framerate)
    .output(output)
    .outputFormat('mp4')
    .outputOptions([
      '-c:v libx264',
      '-pix_fmt yuv420p',
    ])
    .on('progress', ({ percent }) => {
      emitter.emit('progress', {
        percent,
      });
    })
    .on('end', () => {
      // Sometimes ffmpeg wouldn't be able to report for 100% progress
      // because it'll trigger the `end` event first
      emitter.emit('progress', {
        percent: 100,
      });

      emitter.emit('done');
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
