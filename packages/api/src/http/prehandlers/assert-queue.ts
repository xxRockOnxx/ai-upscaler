import { preHandlerAsyncHookHandler } from 'fastify';
import { QueueStore } from '@ai-upscaler/core/src/queue/store';

// eslint-disable-next-line import/prefer-default-export
export function createAssertQueue(queue: QueueStore): preHandlerAsyncHookHandler {
  return async function assertQueue(request, reply) {
    const queueId = request.cookies.queue;

    if (!queueId || !(await queue.get(queueId))) {
      return reply
        .code(400)
        .send({
          message: 'Not in queue or invalid queue id',
        });
    }

    return undefined;
  };
}
