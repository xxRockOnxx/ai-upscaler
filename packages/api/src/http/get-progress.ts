import { QueueStore } from '@ai-upscaler/core/src/queue/store';
import { JobStore } from '@ai-upscaler/core/src/jobs/store';
import { Queue } from 'bullmq';
import { RouteHandler } from 'fastify';

interface GetProgressOptions {
  queue: QueueStore
  jobs: JobStore
  bull: Queue
}

export default function createGetProgress({ queue, jobs, bull }: GetProgressOptions): RouteHandler {
  return async function getProgress(request, reply) {
    const queueList = await queue.getAll();
    const queueItem = queueList[request.cookies.queue];

    if (!['processing', 'finished'].includes(queueItem.status)) {
      return reply
        .status(404)
        .send({
          status: 'No data',
        });
    }

    const job = await jobs.get(request.cookies.queue);

    if (!job) {
      return reply
        .status(404)
        .send({
          status: 'No data',
        });
    }

    const jobData = await bull.getJob(job);

    return reply.send(jobData.progress);
  };
}
