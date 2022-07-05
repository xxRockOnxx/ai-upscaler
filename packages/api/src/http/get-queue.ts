import { QueueStore } from '@ai-upscaler/core/src/queue/store';
import { RouteHandler } from 'fastify';

const inactiveStatus = [
  'finished',
  'failed',
];

export default function createGetQueue(queue: QueueStore): RouteHandler {
  return async function getQueue(request, reply) {
    const queueList = await queue.getAll();

    let total = 0;

    // Count total without "inactive" queue items.
    Object.values(queueList).forEach((item) => {
      if (inactiveStatus.includes(item.status)) {
        return;
      }

      total += 1;
    });

    // No cookie or invalid queue id means "idle"
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
}
