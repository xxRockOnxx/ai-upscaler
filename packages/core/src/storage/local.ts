import fs from 'fs-extra';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { Storage } from './storage';

export interface LocalStorage extends Storage {
  /**
   * Get relative path from Storage's root
   * @param path - path to be appended from the Storage's root
   */
  path(relativePath: string): string;

  readdir(dir: string): Promise<string[]>;
}

export default async function createStorage(baseDir: string): Promise<LocalStorage> {
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
      await fs.promises.rm(path.join(baseDir, id));
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
