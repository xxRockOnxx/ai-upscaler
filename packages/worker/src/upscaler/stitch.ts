import ffmpeg from 'fluent-ffmpeg';
import { Task } from './task';

export interface StitchData {
  input: string
  output: string
  framerate: number
}

export const stitchFrames: Task<StitchData, void> = function stitchFrames({
  data: {
    input,
    output,
    framerate,
  },
  onProgress,
  onDone,
  onError,
}) {
  let cancelled = false;

  const command = ffmpeg(input)
    .inputFps(framerate)
    .output(output)
    .outputFormat('mp4')
    .outputOptions([
      '-c:v libx264',
      '-pix_fmt yuv420p',
    ])
    .on('progress', ({ percent }) => onProgress(percent))
    .on('end', () => {
      // For some reason ffmpeg doesn't emit progress 100% when it's done.
      onProgress(100);
      onDone();
    })
    .on('error', (err) => {
      if (!cancelled) {
        onError(err);
      }
    });

  command.run();

  return () => {
    cancelled = true;
    command.kill('');
  };
};
