import path from 'path';
import { spawn } from 'child_process';
import { Task } from './task';
import { InterpolateData } from './interpolate';
import computeProgress from './enhance-common';

export const CAIN_MODEL = 'cain';

export const interpolateFramesCain: Task<InterpolateData, void> = async function interpolateCain(
  {
    input,
    output,
    frameCount,
    frameName,
  },
  { signal, onProgress } = {},
) {
  if (signal?.aborted) {
    throw signal.reason;
  }

  if (frameCount === 0) {
    throw new Error('No frames found');
  }

  // Unlike rife, cain has no `-n` flag — directory mode always
  // produces exactly double the input frame count
  // (main.cpp: `const int numframe = count * 2;`).
  const total = frameCount * 2;

  // cain-ncnn-vulkan resolves its model directory relative to the current
  // working directory by default, which is not the binary's location here.
  // Pass an absolute path so it works regardless of cwd (same reasoning as
  // the rife interpolator).
  const model = path.join(path.dirname(process.env.CAIN_PATH), CAIN_MODEL);

  const cain = spawn(process.env.CAIN_PATH, [
    '-i', input,
    '-o', output,

    '-m', model,

    // `-f` is a printf pattern applied per output index
    // (main.cpp: `sprintf(tmp, pattern.c_str(), i+1)` — numbering starts
    // at 1, like ffmpeg and rife), so the output keeps the pipeline's
    // frame naming and stitching needs no special casing.
    '-f', frameName,

    // Process one file at a time so we can track progress better.
    '-j', '1:1:1',

    '-v',
  ]);

  const abort = () => cain.kill('SIGKILL');
  signal?.addEventListener('abort', abort, { once: true });

  let processed = 0;

  // With `-v`, cain prints one line per saved output frame:
  //   <input0> <input1> <timestep> -> <output> done
  // Source: https://github.com/nihui/cain-ncnn-vulkan/blob/master/src/main.cpp
  // (SaveThreadParams, printed to stderr). We listen on both streams anyway,
  // mirroring the rife interpolator. A single data chunk can contain more
  // than one `done` line, so match globally.
  const donePattern = ['->', path.join(output, '(\\w+\\.png)'), 'done'];
  const doneRegExp = new RegExp(donePattern.join(' '), 'g');

  const onData = (chunk: string) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const [, outputFrame] of chunk.matchAll(doneRegExp)) {
      processed += 1;
      onProgress?.({
        percent: computeProgress(total, processed, 0),
        frames: [outputFrame],
      });
    }
  };

  cain.stdout.setEncoding('utf8').on('data', onData);
  cain.stderr.setEncoding('utf8').on('data', onData);

  try {
    await new Promise<void>((resolve, reject) => {
      cain
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
