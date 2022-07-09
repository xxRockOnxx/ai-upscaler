import { JobStore } from '@ai-upscaler/core/src/jobs/store';
import { QueueStore } from '@ai-upscaler/core/src/queue/store';
import { RouteHandler } from 'fastify';

const inactiveStatus = [
  'finished',
  'failed',
];

interface GetQueueOptions {
  queue: QueueStore
  jobs: JobStore
}

export default function createGetQueue({
  queue,
  jobs,
}: GetQueueOptions): RouteHandler {
  return async function getQueue(request, reply) {
    const id = request.cookies.queue;
    const total = await queue.waitingCount();
    const queueDetails = await queue.get(id);

    // No cookie or invalid queue id means "idle"
    if (!id || !queueDetails) {
      return reply.send({
        total,
        position: null,
        status: 'idle',
      });
    }

    return reply.send({
      total,
      position: inactiveStatus.includes(queueDetails.status) ? null : queueDetails.position,
      status: queueDetails.status,
      job: await jobs.get(id) ?? null,
    });
  };
}
