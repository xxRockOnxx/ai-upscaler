import { JobStore } from '@ai-upscaler/core/src/jobs/store';
import { QueueStore } from '@ai-upscaler/core/src/queue/store';
import { Queue } from 'bullmq';
import { RouteHandler } from 'fastify';

interface PutCancelOptions {
  queue: QueueStore
  jobs: JobStore
  bull: Queue
}

export default function createPutCancel({
  queue,
  jobs,
  bull,
}: PutCancelOptions): RouteHandler {
  return async function putCancel(request, reply) {
    const queueList = await queue.getAll();

    if (queueList[request.cookies.queue].status !== 'processing') {
      return reply
        .status(204)
        .send();
    }

    const job = await jobs.get(request.cookies.queue);

    if (!job) {
      return reply
        .status(204)
        .send();
    }

    bull.add('cancel', {
      id: request.cookies.queue,
    });

    return reply
      .status(204)
      .send();
  };
}
