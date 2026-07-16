import path from 'path';
import { promises as fs } from 'fs-extra';
import ffmpeg from 'fluent-ffmpeg';
import difference from 'lodash.difference';
import { Task } from './task';
import computeProgress from './enhance-common';

export interface EnhanceData {
  input: string
  output: string
}

// Matches FRAME_NAME in ./upscaler (not imported to avoid a require cycle:
// upscaler.ts imports this module).
const FRAME_PATTERN = 'frame_%d.png';

export const enhanceFramesAnime4k: Task<EnhanceData, void> = async function enhanceFramesAnime4k(
  { input, output },
  { signal, onProgress } = {},
) {
  if (signal?.aborted) {
    throw signal.reason;
  }

  const total = (await fs.readdir(input)).length;

  if (total === 0) {
    throw new Error('No frames found');
  }

  // Re-check after the await: if the signal aborted while reading the
  // directory, the 'abort' event has already fired and the listener below
  // would never be called, leaving the ffmpeg process running forever.
  if (signal?.aborted) {
    throw signal.reason;
  }

  let frames: string[] = [];

  // Manually read the output directory to get the enhanced frames
  // and compute the differences to get the new frames.
  async function getNewFrames() {
    const newFrames = await fs.readdir(output);
    const returnvalue = difference(newFrames, frames);
    frames = newFrames;
    return returnvalue;
  }

  // Anime4K is a set of GLSL shaders (originally for mpv), applied here by
  // ffmpeg's libplacebo filter in a single pass over the whole sequence.
  // ANIME4K_PATH points at the combined shader chain (4x = two chained x2
  // upscales) and must not contain a `:` — it is passed unescaped into the
  // filter graph.
  const command = ffmpeg(path.join(input, FRAME_PATTERN))
    .outputOptions([
      '-vf', `libplacebo=w=iw*4:h=ih*4:custom_shader_path=${process.env.ANIME4K_PATH}`,
    ])
    .output(path.join(output, FRAME_PATTERN));

  const abort = () => command.kill('SIGKILL');
  signal?.addEventListener('abort', abort, { once: true });

  try {
    await new Promise<void>((resolve, reject) => {
      command
        .on('progress', async (progress) => {
          // An image2 input has no duration, so fluent-ffmpeg's `percent`
          // is unreliable here — derive it from the processed frame count.
          onProgress?.({
            percent: computeProgress(total, progress.frames ?? 0, 0),
            frames: await getNewFrames(),
          });
        })
        .on('end', async () => {
          // Sometimes ffmpeg wouldn't be able to report for 100% progress
          // because it'll trigger the `end` event first
          onProgress?.({
            percent: 100,
            frames: await getNewFrames(),
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
