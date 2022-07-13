import path from 'path';
import { promises as fs } from 'fs-extra';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { Task } from './task';

export interface EnhanceData {
  input: string
  output: string
}

function computeProgress(totalFiles, processedFiles, currentFile): number {
  // Each processed file = 100% progress.
  // 2 out of 4 frames processed is equivalent to:
  // = ((2 * 100) + 0) / 4 = 50%
  // = 200 / 4 = 50%
  const progress = ((processedFiles * 100) + currentFile) / totalFiles;
  return progress;
}

export const enhanceFrames: Task<EnhanceData, void> = function enhanceFrames({ input, output }) {
  let cancelled = false;
  const emitter = new EventEmitter();

  fs
    .readdir(input)
    .then((frames) => {
      const total = frames.length;

      if (total === 0) {
        throw new Error('No frames found');
      }

      const realesrgan = spawn(process.env.REAL_ESRGAN_PATH, [
        '-i', input,
        '-o', output,

        // @TODO: make this a variable
        '-n', 'realesrgan-x4plus',

        '-s', '4',
        '-f', 'png',

        // Process one file at a time so we can track progress better.
        '-j', '1:1:1',

        '-v',
      ])
        .on('exit', (code, signal) => {
          if (cancelled) {
            emitter.emit('cancelled');
            return;
          }

          if (code === 0) {
            emitter.emit('done');
            return;
          }

          if (code !== null) {
            emitter.emit('error', new Error(`Process exited with code ${code}`));
            return;
          }

          if (signal !== null) {
            emitter.emit('error', new Error(`Process exited with signal ${signal}`));
          }
        })
        .on('error', (err) => {
          emitter.emit('error', err);
        });

      let current = 0;
      let processed = 0;

      realesrgan
        .stderr
        .setEncoding('utf8')
        .on('data', (stderr: string) => {
          // Format: xx.yy%
          // Source: https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/blob/v0.2.0/src/realesrgan.cpp#L553
          const [progress] = stderr.match(/^(\d{1,3}\.\d{2})%$/gm) ?? [];

          if (progress) {
            current = parseFloat(progress);
            emitter.emit('progress', {
              percent: computeProgress(total, processed, current),
              frames: [],
            });
            return;
          }

          // Format: <input> -> <output> done
          // Source: https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/blob/v0.2.0/src/main.cpp#L413
          const donePattern = [path.join(input, '(\\w+\\.png)'), '->', path.join(output, '(\\w+\\.png)'), 'done'];

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const [, inputFrame, outputFrame] = stderr.match(new RegExp(donePattern.join(' '))) ?? [];

          if (outputFrame) {
            processed += 1;
            current = 0;
            emitter.emit('progress', {
              percent: computeProgress(total, processed, current),
              frames: [outputFrame],
            });
          }
        });

      emitter.once('cancel', () => {
        cancelled = true;
        realesrgan.kill('SIGKILL');
      });
    })
    .catch((err) => {
      emitter.emit('error', err);
    });

  return emitter;
};
