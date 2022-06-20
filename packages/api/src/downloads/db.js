/**
 * @typedef Download
 * @type {object}
 * @property {string} file - File path
 * @property {Date} expire_at - Expiration date
 * @property {boolean} active - Whether the download is being downloaded at the moment
 */

module.exports = function downloads(redis) {
  return {
    /**
     * @returns {Promise<Download[]>}
     */
    async getAll() {
      const raw = await redis.hGetAll('downloads');

      // Redis returns null Object so there's no prototype.
      // eslint-disable-next-line no-restricted-syntax,guard-for-in
      for (const key in raw) {
        raw[key] = JSON.parse(raw[key]);
      }

      return raw;
    },

    /**
     * @param {string} id
     * @returns {Promise<Download | null>}
     */
    async getById(id) {
      const raw = await redis.hGet('downloads', id);
      return raw ? JSON.parse(raw) : null;
    },

    async set(id, key, value) {
      const data = (await this.getById(id)) || {};
      data[key] = value;
      await this.save(id, data);
    },

    /**
     * @param {string} id
     * @param {Download} data
     * @returns {Promise<void>}
     */
    async save(id, data) {
      await redis.hSet('downloads', id, JSON.stringify(data));
    },
  };
};
