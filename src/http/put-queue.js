const uuid = require("uuid").v4;
const Storage = require('../storage');

module.exports = function putQueue(queue) {
  return async function (request, reply) {
    const id = request.cookies.queue ?? uuid();
    const list = await queue.getAll();

    await queue
      .join(id)
      .catch((e) => {
        if (e.name !== "QueueError") {
          throw e;
        }

        return queue.refresh(id);
      })
      .catch((e) => {
        if (e.name !== "QueueError") {
          throw e
        }
      })

    reply
      .cookie("queue", id, {
        httpOnly: true,
      })
      .send();

    setTimeout(async () => {
      if (await queue.removeIfExpired(id)) {
        queue.sort();

        Storage.delete(id).catch(() => {
          // The directory might not have existed yet
        })
      }
    }, 1000 * 60)
  };
};
