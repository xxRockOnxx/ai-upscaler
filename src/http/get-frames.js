const fs = require('fs').promises;
const Storage = require('../storage');

module.exports = function createGetFrames() {
  return async function getFrames(request, reply) {
    const id = request.cookies.queue;
    const storage = new Storage(id);

    try {
      const frames = storage.path('enhanced_frames');
      reply.send(await fs.readdir(frames));
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }

      reply.send([]);
    }
  };
};
