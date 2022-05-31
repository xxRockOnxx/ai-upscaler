module.exports = function getQueue(queue) {
  return async function (request, reply) {
    const queueList = await queue.getAll();
    const total = Object.keys(queueList).length;

    // No cookie or invalid queue id
    if (!request.cookies.queue || !queueList[request.cookies.queue]) {
      return reply.send({
        total,
        position: null,
        status: "idle",
      });
    }

    const item = queueList[request.cookies.queue];

    return reply.send({
      total,
      position: item.position,
      status: item.status,
    });
  };
};
