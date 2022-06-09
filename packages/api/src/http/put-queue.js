const uuid = require('uuid').v4;
const Storage = require('../storage');

module.exports = function createPutQueue(queue) {
  return async function putQueue(request, reply) {
    const id = request.cookies.queue ?? uuid();

    await queue
      .join(id)
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

    reply
      .cookie('queue', id, {
        httpOnly: true,
      })
      .status(204);

    setTimeout(async () => {
      if (await queue.removeIfExpired(id)) {
        queue.sort();
        new Storage(id).destroy();
      }
    }, 1000 * 60);
  };
};
