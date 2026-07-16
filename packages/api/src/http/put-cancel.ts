import { JobStore } from '@ai-upscaler/core/src/jobs/store';
import { QueueStore } from '@ai-upscaler/core/src/queue/store';
import { RouteHandler } from 'fastify';
import Redis from 'ioredis';

interface PutCancelOptions {
  queue: QueueStore
  jobs: JobStore
  publish: Redis
}

export default function createPutCancel({
  queue,
  jobs,
  publish,
}: PutCancelOptions): RouteHandler {
  return async function putCancel(request, reply) {
    const entry = await queue.get(request.cookies.queue);

    if (entry?.status !== 'processing') {
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

    publish.publish('cancel', JSON.stringify({
      id: job,
    }));

    return reply
      .status(204)
      .send();
  };
}
