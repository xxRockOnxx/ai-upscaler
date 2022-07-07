import fs from 'fs-extra';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { FrameStorage, Storage } from './storage';

export interface LocalStorage extends Storage {
  /**
   * Get relative path from Storage's root
   * @param path - path to be appended from the Storage's root
   */
  path(relativePath: string): string

  readdir(dir: string): Promise<string[]>

  /**
   * Delete the base directory and all its contents
   */
  destroy(): Promise<void>
}

export async function createStorage(baseDir: string): Promise<LocalStorage> {
  await fs.ensureDir(baseDir);

  return {
    get(id) {
      return Promise.resolve(fs.createReadStream(path.join(baseDir, id)));
    },

    async store(id, file) {
      const outfile = path.join(baseDir, id);
      await promisify(pipeline)(file, fs.createWriteStream(outfile));
    },

    async delete(id) {
      await fs.promises.rm(path.join(baseDir, id), { recursive: true });
    },

    destroy() {
      return fs.promises.rm(baseDir, { recursive: true });
    },

    path(relativePath) {
      return path.join(baseDir, relativePath);
    },

    readdir(dir) {
      return fs
        .readdir(dir)
        .catch((err) => {
          if (err.name === 'ENOENT') {
            return [];
          }

          throw err;
        });
    },
  };
}

export function createFrameStorage(
  storage: LocalStorage,
  { raw: prefixRaw, enhanced: prefixEnhanced } = { raw: 'raw', enhanced: 'enhanced' },
): FrameStorage {
  return {
    getFrames(enhanced = false) {
      return storage.readdir(storage.path(enhanced ? prefixEnhanced : prefixRaw));
    },

    getFrame(frame, enhanced = false) {
      return storage.get(storage.path(`${enhanced ? prefixEnhanced : prefixRaw}/${frame}`));
    },

    storeFrame(frame, file, enhanced = false) {
      const outfile = path.join(enhanced ? prefixEnhanced : prefixRaw, frame);
      return storage.store(outfile, file);
    },

    deleteFrames(enhanced = false) {
      return storage.delete(storage.path(enhanced ? prefixEnhanced : prefixRaw));
    },
  };
}
