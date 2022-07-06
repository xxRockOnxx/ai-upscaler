import * as fs from 'fs-extra';
import * as path from 'path';
import { LocalStorage } from '@ai-upscaler/core/src/storage/local';
import { DIR_ENHANCED_FRAMES } from '../upscaler/upscaler';

export default function createGetFrames(storage: LocalStorage) {
  return function getFrames(id: string): Promise<string[]> {
    return fs.readdir(storage.path(path.join(id, DIR_ENHANCED_FRAMES)));
  };
}
