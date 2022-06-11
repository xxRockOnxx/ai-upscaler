module.exports = function createGetQueue(queue) {
  return async function getQueue(request, reply) {
    const queueList = await queue.getAll();

    const inactiveStatus = [
      'finished',
      'failed',
    ];

    let total = 0;

    Object.values(queueList).forEach((item) => {
      if (inactiveStatus.includes(item.status)) {
        return;
      }

      total += 1;
    });

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
      position: inactiveStatus.includes(item.status) ? null : item.position,
      status: item.status,
    });
  };
};
