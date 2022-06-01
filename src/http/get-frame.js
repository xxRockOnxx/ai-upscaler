const fs = require('fs');
const Storage = require('../storage');

module.exports = function getFrame() {
  return async function (request, reply) {
    const id = request.cookies.queue;
    const storage = new Storage(id);

    try {
      const enhanced = request.query.enhanced === 'true';
      const directory = enhanced ? 'enhanced_frames' : 'frames';

      await fs.promises.access(storage.path(directory));

      reply
        .type('image/png')
        .send(fs.createReadStream(storage.path(directory + '/' + request.params.frame)));
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }

      reply
        .status(404)
        .send();
    }
  }
}
