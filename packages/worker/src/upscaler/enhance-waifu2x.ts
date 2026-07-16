import path from 'path';
import { promises as fs } from 'fs-extra';
import { spawn } from 'child_process';
import { Task } from './task';
import computeProgress from './enhance-common';

export interface EnhanceData {
  input: string
  output: string
}

export const enhanceFramesWaifu2x: Task<EnhanceData, void> = async function enhanceFramesWaifu2x(
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

  // waifu2x-ncnn-vulkan resolves its model directory relative to the current
  // working directory by default, which is not the binary's location here.
  // Pass an absolute path so it works regardless of cwd.
  const models = path.join(path.dirname(process.env.WAIFU2X_PATH), 'models-cunet');

  const waifu2x = spawn(process.env.WAIFU2X_PATH, [
    '-i', input,
    '-o', output,

    '-m', models,

    '-s', '4',
    '-f', 'png',

    // Process one file at a time so we can track progress better.
    '-j', '1:1:1',

    '-v',
  ]);

  const abort = () => waifu2x.kill('SIGKILL');
  signal?.addEventListener('abort', abort, { once: true });

  let processed = 0;

  // Unlike Real-ESRGAN, waifu2x-ncnn-vulkan does not print a per-frame
  // percentage — only a `<input> -> <output> done` line per completed frame.
  // Progress therefore advances one whole frame at a time (currentFile stays
  // 0). It also prints `done` to stdout rather than stderr, so we listen to
  // both streams and match the pattern on either.
  // Format: <input> -> <output> done
  // Source: https://github.com/nihui/waifu2x-ncnn-vulkan/blob/master/src/main.cpp
  // A single data chunk can contain more than one `done` line, so match
  // globally and account for every completed frame — these lines are the only
  // progress signal waifu2x emits.
  const donePattern = [path.join(input, '(\\w+\\.png)'), '->', path.join(output, '(\\w+\\.png)'), 'done'];
  const doneRegExp = new RegExp(donePattern.join(' '), 'g');

  const onData = (chunk: string) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const [, , outputFrame] of chunk.matchAll(doneRegExp)) {
      processed += 1;
      onProgress?.({
        percent: computeProgress(total, processed, 0),
        frames: [outputFrame],
      });
    }
  };

  waifu2x.stdout.setEncoding('utf8').on('data', onData);
  waifu2x.stderr.setEncoding('utf8').on('data', onData);

  try {
    await new Promise<void>((resolve, reject) => {
      waifu2x
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
