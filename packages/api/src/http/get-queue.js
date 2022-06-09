module.exports = function createGetQueue(queue) {
  return async function getQueue(request, reply) {
    const queueList = await queue.getAll();

    const inactiveStatus = [
      'finished',
      'failed',
    ];

    Object.keys(queueList).forEach((key) => {
      const queueItem = queueList[key];

      if (inactiveStatus.includes(queueItem.status)) {
        delete queueList[key];
      }
    });

    const total = Object.keys(queueList).length;

    // No cookie or invalid queue id
    if (!request.cookies.queue || !queueList[request.cookies.queue]) {
      return reply.send({
        total,
        position: null,
        status: 'idle',
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
