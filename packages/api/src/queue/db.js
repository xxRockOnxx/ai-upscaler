const { QueueError } = require('./errors');

// Valid status are:
// idle
// waiting
// ready
// processing
// finished
// failed
module.exports = function createQueue(redis) {
  return {
    async getAll() {
      const raw = await redis.hGetAll('queue');

      // Redis returns null Object so there's no prototype.
      // eslint-disable-next-line no-restricted-syntax,guard-for-in
      for (const key in raw) {
        raw[key] = JSON.parse(raw[key]);
      }

      return raw;
    },

    async join(id, forced = false) {
      const list = await this.getAll();

      if (!list[id]) {
        const position = Object.keys(list).length + 1;
        const status = position === 1 ? 'ready' : 'waiting';

        await this.save(id, {
          status,
          position,
          updatedAt: Date.now(),
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
        await redis.hDel('queue', id);
        await this.join(id);
        return;
      }

      throw new QueueError('Unknow status');
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
        updatedAt: Date.now(),
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
        updatedAt: Date.now(),
      });
    },

    async save(id, data) {
      await redis.hSet('queue', id, JSON.stringify(data));
    },

    async removeIfExpired(id) {
      const list = await this.getAll();

      // Nothing to do.
      // No need to throw an error. Should be idempontent.
      if (!list[id]) {
        return true;
      }

      const item = list[id];
      const updatedAt = new Date(item.updatedAt);

      // Fixed time for now.
      const expiryOngoing = 1000 * 60;
      const expiryFinal = 1000 * 60 * 60;

      const ongoingStatus = [
        'waiting',
        'ready',
        'processing',
      ];

      if (ongoingStatus.includes(item.status) && updatedAt < Date.now() - expiryOngoing) {
        await redis.hDel('queue', id);
        return true;
      }

      // Make final status available for a longer time
      // to allow users to see about the status.
      const finalStatus = [
        'failed',
        'finished',
      ];

      if (finalStatus.includes(item.status) && updatedAt < Date.now() - expiryFinal) {
        await redis.hDel('queue', id);
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
};

module.exports.QueueError = QueueError;
