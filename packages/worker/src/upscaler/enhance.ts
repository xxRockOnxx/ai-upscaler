import path from 'path';
import { promises as fs } from 'fs-extra';
import { spawn } from 'child_process';
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

export const enhanceFrames: Task<EnhanceData, void> = async function enhanceFrames(
  { input, output },
  { signal, onProgress } = {},
) {
  if (signal?.aborted) {
    throw signal.reason;
  }

  const frames = await fs.readdir(input);
  const total = frames.length;

  if (total === 0) {
    throw new Error('No frames found');
  }

  // Re-check after the await: if the signal aborted while reading the
  // directory, the 'abort' event has already fired and the listener below
  // would never be called, leaving the spawned process running forever.
  if (signal?.aborted) {
    throw signal.reason;
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
  ]);

  const abort = () => realesrgan.kill('SIGKILL');
  signal?.addEventListener('abort', abort, { once: true });

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
        onProgress?.({
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
        onProgress?.({
          percent: computeProgress(total, processed, current),
          frames: [outputFrame],
        });
      }
    });

  try {
    await new Promise<void>((resolve, reject) => {
      realesrgan
        .on('exit', (code, exitSignal) => {
          if (signal?.aborted) {
            reject(signal.reason);
            return;
          }

          if (code === 0) {
            resolve();
            return;
          }

          if (code !== null) {
            reject(new Error(`Process exited with code ${code}`));
            return;
          }

          if (exitSignal !== null) {
            reject(new Error(`Process exited with signal ${exitSignal}`));
          }
        })
        .on('error', reject);
    });
  } finally {
    signal?.removeEventListener('abort', abort);
  }
};
