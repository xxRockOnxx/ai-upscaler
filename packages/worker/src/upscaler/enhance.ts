import * as path from 'path';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { Task } from './task';

export interface EnhanceData {
  input: string
  output: string
}

function enhanceFrame({
  input,
  output,
  onDone,
  onError,
}) {
  const args = [
    '-i',
    input,

    '-o',
    output,

    '-s',
    '4',

    '-f',
    'png',

    // @TODO: make this a variable
    '-n',
    'realesrgan-x4plus',
  ];

  const command = `${process.env.REAL_ESRGAN_PATH} ${args.join(' ')}`;

  const proc = exec(command, (code, out, err) => {
    if (code) {
      onError(new Error(err));
    } else {
      onDone();
    }
  });

  return () => proc.kill();
}

export const enhanceFrames: Task<EnhanceData, void> = function enhanceFrames({
  data,
  onProgress,
  onDone,
  onError,
}) {
  let cancelled = false;
  let cancelFn: () => void;

  fs
    .readdir(data.input)
    .then(async (frames) => {
      if (cancelled) {
        return;
      }

      // eslint-disable-next-line no-restricted-syntax
      for (const [i, frame] of frames.entries()) {
        // Parallelization won't help here.
        // Enhancing is bound by the GPU's performance.
        // eslint-disable-next-line no-await-in-loop, no-loop-func
        await new Promise((resolve, reject) => {
          cancelFn = enhanceFrame({
            input: path.join(data.input, frame),
            output: path.join(data.output, frame),
            onDone: resolve,
            onError: reject,
          });
        });

        const progressPercent = ((i + 1) / frames.length) * 100;

        // Pass frame as array to be consistent with ffmpeg tasks.
        onProgress(progressPercent, [frame]);
      }
    })
    .then(() => {
      if (!cancelled) {
        onDone();
      }
    })
    .catch((err) => {
      if (!cancelled) {
        onError(err);
      }
    });

  return () => {
    cancelled = true;

    if (cancelFn) {
      cancelFn();
    }
  };
};
