import { ffprobe, FfprobeData } from 'fluent-ffmpeg';
import { promisify } from 'util';

// ffprobe happily parses still images as single-frame "video" streams
// (e.g. a JPEG probes as format `image2` with an mjpeg stream), so the
// container format has to be checked before trusting the stream list.
const IMAGE_FORMATS = new Set([
  'image2',
  'image2pipe',
  'jpeg_pipe',
  'png_pipe',
  'webp_pipe',
  'bmp_pipe',
  'tiff_pipe',
  'gif',
]);

export default async function analyze(input: string) {
  const metadata = await promisify(ffprobe)(input) as FfprobeData;

  const formats = (metadata.format.format_name ?? '').split(',');

  if (formats.some((format) => IMAGE_FORMATS.has(format))) {
    throw new Error('Input is a still image, not a video');
  }

  const video = metadata.streams.find((stream) => stream.codec_type === 'video');

  if (!video) {
    throw new Error('No video stream found');
  }

  return video;
}
