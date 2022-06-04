module.exports = function getProgress(queue, jobs) {
  return async function (request, reply) {
    const queueList = await queue.getAll();
    const queueItem = queueList[request.cookies.queue];

    if (!["processing", "finished"].includes(queueItem.status)) {
      return reply.send({
        status: queueItem.status,
      });
    }

    const job = await jobs.getById(request.cookies.queue);

    if (!job) {
      return reply.send({
        status: "No data",
      });
    }

    reply.send(job.progress);
  };
};
