import { Redis } from 'ioredis';
import { RouteHandler } from 'fastify';

interface GetFramesOptions {
  publish: Redis
  subscribe: Redis
  timeout: number
}

export default function createGetFrames({
  publish,
  subscribe,
  timeout,
}: GetFramesOptions): RouteHandler {
  return async function getFrames(request, reply) {
    const id = request.cookies.queue;

    publish.publish('getFrames', JSON.stringify({
      id,
    }));

    subscribe.on('message', function listener(channel, message) {
      const data = JSON.parse(message);

      const timeoutId = setTimeout(() => {
        reply.send([]);
        subscribe.off('message', listener);
      }, timeout);

      if (channel === 'getFrames:response' && data.id === id) {
        reply.send(data.frames);
        subscribe.off('message', listener);
        clearTimeout(timeoutId);
      }
    });

    return reply;
  };
}
