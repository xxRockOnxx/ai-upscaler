class QueueError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QueueError';
  }
}

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

    async join(id) {
      const list = await this.getAll();

      if (!list[id]) {
        const position = Object.keys(list).length + 1;
        const status = position === 1 ? "ready" : "waiting";

        await this.save(id, {
          status,
          position,
          updatedAt: Date.now(),
        });

        return;
      }

      const joinableStatus = [
        "idle",
        "finished",
        "failed",
      ]

      if (!joinableStatus.includes(list[id].status)) {
        throw new QueueError("Already in queue");
      }

      const position = Object.keys(list).length;
      const status = position === 1 ? "ready" : "waiting";

      await this.save(id, {
        status,
        position,
        updatedAt: Date.now(),
      });
    },

    async refresh(id) {
      const list = await this.getAll();
      const item = list[id];

      if (!item) {
        throw new QueueError('Queue item not found');
      }

      const refreshableStatus = ['waiting', 'ready', 'processing'];

      if (!refreshableStatus.includes(item.status)) {
        throw new QueueError('Queue item not in refreshable status');
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
      const item = list[id] ?? {};
      const updatedAt = new Date(item.updatedAt);
      const expiryWaiting = 1000 * 60;
      const expiryFinished = 1000 * 60 * 60;

      const expirableStatus = [
        'waiting',
        'ready',
        'processing',
      ];

      if (
        expirableStatus.includes(item.status)
        && updatedAt < Date.now() - expiryWaiting
      ) {
        await redis.hDel('queue', id);
        return true;
      }

      // Figure out a way to separate download expiry from queue expiry
      if (item.status === 'finished' && updatedAt < Date.now() - expiryFinished) {
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
