import { ffprobe, FfprobeData } from 'fluent-ffmpeg';
import { promisify } from 'util';

export default async function analyze(input: string) {
  const metadata = await promisify(ffprobe)(input) as FfprobeData;
  const video = metadata.streams.find((stream) => stream.codec_type === 'video');

  if (!video) {
    throw new Error('No video stream found');
  }

  return video;
}
