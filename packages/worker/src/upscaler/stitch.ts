import ffmpeg from 'fluent-ffmpeg';
import { Task } from './task';

export interface StitchData {
  input: string
  output: string
  framerate: number
}

export interface StitchProgress {
  percent: number
}

export const stitchFrames: Task<StitchData, void, StitchProgress> = async function stitchFrames(
  {
    input,
    output,
    framerate,
  },
  { signal, onProgress } = {},
) {
  if (signal?.aborted) {
    throw signal.reason;
  }

  const command = ffmpeg(input)
    .inputFps(framerate)
    .output(output)
    .outputFormat('mp4')
    .outputOptions([
      '-c:v libx264',
      '-pix_fmt yuv420p',
    ]);

  const abort = () => command.kill('SIGKILL');
  signal?.addEventListener('abort', abort, { once: true });

  try {
    await new Promise<void>((resolve, reject) => {
      command
        .on('progress', ({ percent }) => {
          onProgress?.({
            percent,
          });
        })
        .on('end', () => {
          // Sometimes ffmpeg wouldn't be able to report for 100% progress
          // because it'll trigger the `end` event first
          onProgress?.({
            percent: 100,
          });

          resolve();
        })
        .on('error', (err) => {
          reject(signal?.aborted ? signal.reason : err);
        });

      command.run();
    });
  } finally {
    signal?.removeEventListener('abort', abort);
  }
};
