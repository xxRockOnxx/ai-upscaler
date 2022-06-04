module.exports = function putCancel(redis, queue, jobs) {
  return async function(request, reply) {
    const queueList = await queue.getAll();

    if (queueList[request.cookies.queue].status !== "processing") {
      reply.status(204).send();
      return;
    }

    const job = await jobs.getById(request.cookies.queue);

    if (job) {
      redis.publish("cancel", job.id);
    }

    reply.status(204).send();
  }
}
