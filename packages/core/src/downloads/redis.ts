import type Redis from 'ioredis';
import { DownloadStore } from './store';

export default function createStore(redis: Redis): DownloadStore {
  return {
    async getAll() {
      const raw = await redis.hgetall('downloads');
      const parsed = {};

      // Redis returns null Object so there's no prototype.
      // eslint-disable-next-line no-restricted-syntax,guard-for-in
      for (const key in raw) {
        parsed[key] = JSON.parse(raw[key]);
      }

      return parsed;
    },

    async getById(id) {
      const raw = await redis.hget('downloads', id);
      return raw ? JSON.parse(raw) : null;
    },

    async set(id, key, value): Promise<void> {
      const data = (await this.getById(id)) || {};
      data[key] = value;
      await this.save(id, data);
    },

    async save(id, data): Promise<void> {
      await redis.hset('downloads', id, JSON.stringify(data));
    },
  };
}
