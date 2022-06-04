async function getJobDetails(queue, id) {
  const [jobDetails, logs] = await Promise.all([
    queue.getJob(id),
    queue.getJobLogs(id, 0, 0, false),
  ]);

  return {
    progress: jobDetails?.progress() ?? 0,
    startedAt: jobDetails?.timestamp ?? null,
    finishedAt: jobDetails?.finishedOn ?? null,
    log: logs.logs[0],
  };
}

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
