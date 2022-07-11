import path from 'path';
import { promises as fs } from 'fs-extra';
import { spawn } from 'child_process';
import { Task } from './task';

export interface EnhanceData {
  input: string
  output: string
}

function computeProgress(totalFiles, processedFiles, currentFile) {
  // Each processed file = 100% progress.
  // 2 out of 4 frames processed is equivalent to:
  // = ((2 * 100) + 0) / 4 = 50%
  // = 200 / 4 = 50%
  const progress = ((processedFiles * 100) + currentFile) / totalFiles;
  return progress;
}

async function runProgram({
  input,
  output,
  onDone,
  onError,
  onProgress,
}) {
  const frames = await fs.readdir(input);
  const total = frames.length;

  if (total === 0) {
    onError(new Error('No frames found'));
    return undefined;
  }

  const child = spawn(process.env.REAL_ESRGAN_PATH, [
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
      if (code === 0) {
        onDone();
        return;
      }

      if (code !== null) {
        onError(new Error(`Process exited with code ${code}`));
        return;
      }

      if (signal !== null) {
        onError(new Error(`Process exited with signal ${signal}`));
      }
    })
    .on('error', onError);

  let current = 0;
  let processed = 0;

  child
    .stderr
    .setEncoding('utf8')
    .on('data', (stderr: string) => {
      // Check if printed output matches "10.00%" or "100.00%" pattern.
      const [progress] = stderr.match(/^(\d{1,3}\.\d{2})%$/gm) ?? [];

      if (progress) {
        current = parseFloat(progress);
        onProgress(computeProgress(total, processed, current), []);
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
        onProgress(computeProgress(total, processed, current), [outputFrame]);
      }
    });

  return child.kill;
}

export const enhanceFrames: Task<EnhanceData, void> = function enhanceFrames({
  data,
  onProgress,
  onDone,
  onError,
}) {
  let cancelled = false;
  let cancelFn: () => void;

  runProgram({
    input: data.input,
    output: data.output,
    onProgress,
    onDone,
    onError(err) {
      if (!cancelled) {
        onError(err);
      }
    },
  })
    .then((cancelFn2) => {
      cancelFn = cancelFn2;
    })
    .catch(onError);

  return () => {
    cancelled = true;

    if (cancelFn) {
      cancelFn();
    }
  };
};
