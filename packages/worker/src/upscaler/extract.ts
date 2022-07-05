import ffmpeg from 'fluent-ffmpeg';
import { Task } from './task';

export interface ExtractData {
  input: string
  output: string
}

export const extractFrames: Task<ExtractData, string[]> = function extractFrames({
  data,
  onProgress,
  onDone,
  onError,
}) {
  let details;

  const command = ffmpeg(data.input)
    .output(data.output)
    .outputOptions([
      '-qscale:v 1',
      '-qmin 1',
      '-qmax 1',
      '-vsync passthrough',
    ])
    .on('codecData', ({ video_details }) => {
      details = video_details;
    })
    .on('progress', ({ percent }) => onProgress(percent))
    .on('end', () => {
      onDone(details);
    })
    .on('error', onError);

  command.run();

  return () => command.kill('');
};
