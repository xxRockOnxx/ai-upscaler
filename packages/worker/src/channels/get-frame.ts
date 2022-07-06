import * as path from 'path';
import concat from 'concat-stream';
import { LocalStorage } from '@ai-upscaler/core/src/storage/local';
import { DIR_FRAMES, DIR_ENHANCED_FRAMES } from '../upscaler/upscaler';

interface GetFrameRequest {
  id: string;
  frame: string;
  enhanced: boolean;
}

export default function createGetFrame(storage: LocalStorage) {
  return async function getFrame({ id, frame, enhanced }: GetFrameRequest) {
    const dir = enhanced
      ? DIR_ENHANCED_FRAMES
      : DIR_FRAMES;

    const stream = await storage.get(path.join(id, dir, frame));

    return new Promise((resolve, reject) => {
      stream
        .on('error', reject)
        .pipe(concat((buffer) => {
          resolve(buffer.toJSON());
        }));
    });
  };
}
