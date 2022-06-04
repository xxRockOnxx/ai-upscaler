module.exports = function (redis) {
  return {
    async getById(id) {
      const raw = await redis.hGet("jobs", id);
      return raw ? JSON.parse(raw) : null;
    },

    async set(id, key, value) {
      const data = (await this.getById(id)) || {};
      data[key] = value;
      await this.save(id, data);
    },

    async save(id, data) {
      await redis.hSet("jobs", id, JSON.stringify(data));
    }
  }
}
