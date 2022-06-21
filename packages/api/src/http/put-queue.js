const uuid = require('uuid').v4;
const Storage = require('../upscaler/storage');

module.exports = function createPutQueue(queue) {
  return async function putQueue(request, reply) {
    const id = request.cookies.queue ?? uuid();
    const forced = request.body && request.body.forced;

    await queue
      .join(id, forced)
      .catch((e) => {
        if (e.name !== 'QueueError') {
          throw e;
        }

        return queue.refresh(id);
      })
      .catch((e) => {
        if (e.name !== 'QueueError') {
          throw e;
        }
      });

    setTimeout(async () => {
      if (await queue.removeIfExpired(id)) {
        queue.sort();
        new Storage(id).destroy();
      }
    }, 1000 * 60);

    return reply
      .cookie('queue', id, {
        httpOnly: true,
      })
      .status(204);
  };
};
