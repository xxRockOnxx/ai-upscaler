import { Client } from 'minio';
import * as path from 'path';
import { FrameStorage, Storage } from './storage';

export function createStorage(minio: Client, bucket: string, prefix = ''): Storage {
  return {
    get(id) {
      return minio.getObject(bucket, path.join(prefix, id));
    },

    async store(id, file) {
      await minio.putObject(bucket, path.join(prefix, id), file);
    },

    async delete(id) {
      await minio.removeObject(bucket, path.join(prefix, id));
    },
  };
}

export function createFrameStorage(
  minio: Client,
  bucket: string,
  id: string,
  { raw: prefixRaw, enhanced: prefixEnhanced } = { raw: 'raw', enhanced: 'enhanced' },
): FrameStorage {
  return {
    getFrames(enhanced = false) {
      const fullPrefix = `${id}/${enhanced ? prefixEnhanced : prefixRaw}/`;
      const stream = minio.listObjects(bucket, id, true);

      return new Promise((resolve, reject) => {
        const returnvalue = [];
        stream
          .on('data', ({ name }) => {
            if (name.startsWith(fullPrefix)) {
              returnvalue.push(name.replace(fullPrefix, ''));
            }
          })
          .once('error', reject)
          .on('end', () => resolve(returnvalue));
      });
    },

    getFrame(frame, enhanced = false) {
      const fullPrefix = `${id}/${enhanced ? prefixEnhanced : prefixRaw}/${frame}`;

      return minio
        .getObject(bucket, fullPrefix)
        .catch((err) => {
          if (err.code === 'NoSuchKey') {
            return undefined;
          }

          throw err;
        });
    },

    async storeFrame(frame, file, enhanced = false) {
      const fullPrefix = `${id}/${enhanced ? prefixEnhanced : prefixRaw}/${frame}`;
      await minio.putObject(bucket, fullPrefix, file);
    },

    async deleteFrames(enhanced = false) {
      const fullPrefix = `${id}/${enhanced ? prefixEnhanced : prefixRaw}/`;
      const frames = await this.getFrames(enhanced);
      return minio.removeObjects(bucket, frames.map((frame) => fullPrefix + frame));
    },
  };
}
