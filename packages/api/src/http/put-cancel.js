module.exports = function createPutCancel(redis, queue, jobs) {
  return async function putCancel(request, reply) {
    const queueList = await queue.getAll();

    if (queueList[request.cookies.queue].status !== 'processing') {
      return reply
        .status(204)
        .send();
    }

    const job = await jobs.getById(request.cookies.queue);

    if (job) {
      redis.publish('cancel', job.id);
    }

    return reply
      .status(204)
      .send();
  };
};
