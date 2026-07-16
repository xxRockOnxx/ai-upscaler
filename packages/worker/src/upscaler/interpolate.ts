import path from 'path';
import { spawn } from 'child_process';
import { Task } from './task';
import computeProgress from './enhance-common';

export interface InterpolateData {
  input: string
  output: string

  // rife needs an explicit target frame count (`-n`); we always
  // interpolate to double the input frame count.
  frameCount: number

  // Output filename pattern (e.g. `frame_%d.png`). Passed in by the caller
  // to keep the pipeline-wide naming in one place (`FRAME_NAME` lives in
  // upscaler.ts, which imports this module — importing it back would be
  // a cycle).
  frameName: string
}

export const RIFE_MODEL = 'rife-v4.6';

export const interpolateFrames: Task<InterpolateData, void> = async function interpolateFrames(
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

  const total = frameCount * 2;

  // rife-ncnn-vulkan resolves its model directory relative to the current
  // working directory by default, which is not the binary's location here.
  // Pass an absolute path so it works regardless of cwd (same reasoning as
  // the waifu2x enhancer).
  const model = path.join(path.dirname(process.env.RIFE_PATH), RIFE_MODEL);

  const rife = spawn(process.env.RIFE_PATH, [
    '-i', input,
    '-o', output,

    '-m', model,

    // Interpolate to exactly double the frame count. rife-v4 models support
    // arbitrary targets, and we need the total for progress anyway.
    '-n', String(total),

    // `-f` is a printf pattern applied per output index
    // (main.cpp: `sprintf(tmp, pattern.c_str(), i+1)` — numbering starts
    // at 1, like ffmpeg), so the output keeps the pipeline's frame naming
    // and stitching needs no special casing.
    '-f', frameName,

    // Process one file at a time so we can track progress better.
    '-j', '1:1:1',

    '-v',
  ]);

  const abort = () => rife.kill('SIGKILL');
  signal?.addEventListener('abort', abort, { once: true });

  let processed = 0;

  // With `-v`, rife prints one line per saved output frame:
  //   <input0> <input1> <timestep> -> <output> done
  // Source: https://github.com/nihui/rife-ncnn-vulkan/blob/master/src/main.cpp
  // (SaveThreadParams, printed to stderr). We listen on both streams anyway,
  // mirroring the waifu2x enhancer. A single data chunk can contain more than
  // one `done` line, so match globally.
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

  rife.stdout.setEncoding('utf8').on('data', onData);
  rife.stderr.setEncoding('utf8').on('data', onData);

  try {
    await new Promise<void>((resolve, reject) => {
      rife
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
