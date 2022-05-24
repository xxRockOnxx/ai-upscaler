module.exports = function getQueue(queue) {
  return async function (request, reply) {
    const queueList = await queue.getAll();

    // No cookie or invalid queue id
    if (!request.cookies.queue || !queueList[request.cookies.queue]) {
      return reply.send({
        total: Object.keys(queueList).length,
        position: null,
      });
    }

    const queueItem = queueList[request.cookies.queue];

    return reply.send({
      total: Object.keys(queueList).length,
      position: queueItem.position,
    });
  };
};
