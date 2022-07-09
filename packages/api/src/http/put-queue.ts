import { v4 as uuid } from 'uuid';
import { QueueStore } from '@ai-upscaler/core/src/queue/store';
import { RouteHandler as BaseRouteHandler } from 'fastify';

type RouteHandler = BaseRouteHandler<{
  Body: {
    forced: boolean
  }
}>

interface PutQueueOptions {
  queue: QueueStore
  cancelJob: (id: string) => void
}

export default function createPutQueue({ queue, cancelJob }: PutQueueOptions): RouteHandler {
  return async function putQueue(request, reply) {
    const id = request.cookies.queue ?? uuid();
    const forced = request.body && request.body.forced;

    await queue
      .join(id, forced)
      .catch((e) => {
        if (e.name !== 'QueueError') {
          throw e;
        }

        return queue.refresh(id);
      })
      .catch((e) => {
        if (e.name !== 'QueueError') {
          throw e;
        }
      });

    setTimeout(() => {
      queue
        .removeIfExpired(id)
        .then((removed) => {
          if (removed) {
            queue.sortWaiting();
            cancelJob(id);
          }
        });
    }, 1000 * 60);

    return reply
      .cookie('queue', id, {
        httpOnly: true,
      })
      .status(204)
      .send();
  };
}
