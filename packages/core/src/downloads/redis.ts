import type Redis from 'ioredis';
import { DownloadStore } from './store';

export default function createStore(redis: Redis): DownloadStore {
  return {
    async get(id) {
      return redis.get(`downloads:${id}`);
    },

    async save(id, data) {
      await redis.set(`downloads:${id}`, data);
    },

    async delete(id) {
      await redis.del(`downloads:${id}`);
    },
  };
}
