import Redis from 'ioredis';
import { QueueError, QueueStore } from './store';

export default function createStore(redis: Redis): QueueStore {
  return {
    async getAll() {
      redis.pipeline();
      const keys = await redis.keys('queue:*');

      const parsed = {};
      const pipeline = redis.pipeline();

      keys.forEach((key) => {
        pipeline.hgetall(key, (err, result) => {
          if (err) {
            throw err;
          }

          const actualKey = key.replace('queue:', '');
          parsed[actualKey] = result;
          parsed[actualKey].position = parseInt(result.position, 10);
          parsed[actualKey].updatedAt = new Date(result.updatedAt);
        });
      });

      await pipeline.exec();

      return parsed;
    },

    async join(id, forced = false) {
      const list = await this.getAll();

      if (!list[id]) {
        const totalWaiting = Object.values(list).filter(({ status }) => ['waiting', 'ready', 'processing'].includes(status)).length;
        const position = totalWaiting + 1;
        const status = position === 1 ? 'ready' : 'waiting';

        await this.save(id, {
          status,
          position,
          updatedAt: new Date(),
        });

        return;
      }

      if (['waiting', 'ready', 'processing'].includes(list[id].status)) {
        throw new QueueError('Already in queue');
      }

      if (['failed', 'finished'].includes(list[id].status) && !forced) {
        throw new QueueError('Job has already reached a final state. Cannot join queue unless forced.');
      }

      if (['failed', 'finished'].includes(list[id].status) && forced) {
        await redis.del(`queue:${id}`);
        await this.join(id);
        return;
      }

      throw new QueueError('Unknown status');
    },

    async refresh(id) {
      const list = await this.getAll();
      const item = list[id];

      if (!item) {
        throw new QueueError('Queue item not found');
      }

      if (['failed', 'finished'].includes(list[id].status)) {
        throw new QueueError('Job has already reached a final state. Cannot join queue unless forced.');
      }

      await this.save(id, {
        ...item,
        updatedAt: new Date(),
      });
    },

    async markAsStatus(id, status) {
      const list = await this.getAll();
      const item = list[id];

      if (!item) {
        throw new QueueError('Queue item not found');
      }

      await this.save(id, {
        ...item,
        status,
        updatedAt: new Date(),
      });
    },

    async save(id, data) {
      await redis.hset(`queue:${id}`, data);
    },

    async removeIfExpired(id) {
      const list = await this.getAll();

      // Nothing to do.
      // No need to throw an error.
      // This operation is idempontent.
      if (!list[id]) {
        return true;
      }

      const item = list[id];

      // Fixed time for now.
      const expiryOngoing = new Date(Date.now() - 1000 * 60);
      const expiryFinal = new Date(Date.now() - 1000 * 60 * 60);

      const ongoingStatus = [
        'waiting',
        'ready',
        'processing',
      ];

      if (ongoingStatus.includes(item.status) && item.updatedAt <= expiryOngoing) {
        await redis.hdel('queue', id);
        return true;
      }

      // Make final status available for a longer time
      // to allow users to see about the status.
      const finalStatus = [
        'failed',
        'finished',
      ];

      if (finalStatus.includes(item.status) && item.updatedAt <= expiryFinal) {
        await redis.hdel('queue', id);
        return true;
      }

      return false;
    },

    async sort() {
      const list = await this.getAll();

      await Object.keys(list)
        .filter((id) => list[id].status === 'waiting')
        .sort((a, b) => list[a].position - list[b].position)
        .map((id, index) => {
          list[id].position = index + 1;

          if (list[id].position === 1) {
            list[id].status = 'ready';
          }

          return this.save(id, list[id]);
        });
    },
  };
}
