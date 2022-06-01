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

module.exports = function getProgress(queue, jobs, upscaler) {
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

    const response = {
      status: "processing",
    };

    if (job.upscaling) {
      response.upscaling = await getJobDetails(upscaler.queue.upscale, job.upscaling);
    }

    if (job.extracting) {
      response.extracting = await getJobDetails(upscaler.queue.extract, job.extracting);
    }

    if (job.enhancing) {
      response.enhancing = await getJobDetails(upscaler.queue.enhance, job.enhancing);
    }

    if (job.stitching) {
      response.stitching = await getJobDetails(upscaler.queue.stitch, job.stitching);
    }

    reply.send(response);
  };
};
