import { Client } from 'minio';
import { Storage } from './storage';

export default function createStorage(minio: Client, bucket): Storage {
  return {
    get(id) {
      return minio.getObject(bucket, id);
    },

    async store(id, file) {
      await minio.putObject(bucket, id, file);
    },

    async delete(id) {
      await minio.removeObject(bucket, id);
    },
  };
}
