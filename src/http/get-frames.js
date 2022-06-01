const fs = require('fs').promises;
const Storage = require('../storage');

module.exports = function getFrames() {
  return async function (request, reply) {
    const id = request.cookies.queue;
    const storage = new Storage(id);

    try {
      await fs.access(storage.path('enhanced_frames'));
      const frames = storage.path("enhanced_frames");
      reply.send(await fs.readdir(frames));
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }

      reply.send([]);
    }
  }
}
