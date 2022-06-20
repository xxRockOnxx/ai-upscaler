const fs = require('fs').promises;
const Storage = require('../upscaler/storage');

module.exports = function createGetFrames() {
  return async function getFrames(request, reply) {
    const id = request.cookies.queue;
    const storage = new Storage(id);

    try {
      const frames = storage.enhancedPath();
      reply.send(await fs.readdir(frames));
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }

      reply.send([]);
    }
  };
};
