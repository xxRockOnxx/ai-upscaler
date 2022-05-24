module.exports = function createQueue(redis) {
  return {
    async getAll() {
      const raw = await redis.hGetAll("queue");

      for (const key in raw) {
        raw[key] = JSON.parse(raw[key]);
      }

      return raw;
    },

    async save(id, data) {
      await redis.hSet("queue", id, JSON.stringify(data));
    },

    async upsert(id, data) {
      const list = await this.getAll();
      const current = list[id] ?? {};
      await this.save(id, {
        ...current,
        ...data,
      });
    },

    async removeExpired() {
      const list = await this.getAll();
      const expired = [];

      Object.keys(list).forEach((id) => {
        const item = list[id];
        const updatedAt = new Date(item.updatedAt)

        const expiryFinished = 1000 * 60 * 60;
        const expiryWaiting = 1000 * 60;

        const expiredFinished = item.status === "finished" && updatedAt < Date.now() - expiryFinished
        const expiredWaiting = item.status === "waiting" && updatedAt < Date.now() - expiryWaiting

        if (expiredFinished || expiredWaiting || item.status === "failed") {
          expired.push(id);
          delete list[id];
        }
      });

      const taskDelete = expired.map((id) => redis.hDel("queue", id));

      const taskUpdate = Object.keys(list)
        .filter((id) => list[id].status === "waiting")
        .sort((a, b) => list[a].position - list[b].position)
        .map((id, index) => {
          list[id].position = index + 1;
          this.save(id, list[id])
        });

      await Promise.all(taskDelete, taskUpdate);

      return expired
    },
  };
}
