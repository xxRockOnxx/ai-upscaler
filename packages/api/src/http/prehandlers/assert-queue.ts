import { preHandlerAsyncHookHandler } from 'fastify';
import { QueueStore } from '@ai-upscaler/core/src/queue/store';

// eslint-disable-next-line import/prefer-default-export
export function createAssertQueue(queue: QueueStore): preHandlerAsyncHookHandler {
  return async function assertQueue(request, reply) {
    const queueList = await queue.getAll();

    if (!request.cookies.queue || !queueList[request.cookies.queue]) {
      reply.code(400).send('Not in queue or invalid queue id');
    }
  };
}
