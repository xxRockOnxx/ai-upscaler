import type Redis from 'ioredis';
import { JobStore } from './store';

export default function createStore(redis: Redis): JobStore {
  return {
    async save(id, job) {
      await redis.set(`job:${id}`, job);
    },

    get(id) {
      return redis.get(`job:${id}`);
    },

    async delete(id) {
      await redis.del(`job:${id}`);
    },
  };
}
