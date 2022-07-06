import { Redis } from 'ioredis';
import { RouteHandler as BaseRouteHandler } from 'fastify';

type RouteHandler = BaseRouteHandler<{
  Querystring: {
    enhanced: string
  },
  Params: {
    frame: string
  }
}>

interface GetFrameOptions {
  publish: Redis
  subscribe: Redis
  timeout: number
}

export default function createGetFrame({
  publish,
  subscribe,
  timeout,
}: GetFrameOptions): RouteHandler {
  return async function getFrame(request, reply) {
    const id = request.cookies.queue;
    const enhanced = request.query.enhanced === 'true';

    publish.publish('getFrame', JSON.stringify({
      id,
      enhanced,
      frame: request.params.frame,
    }));

    subscribe.on('message', function listener(channel, message) {
      const data = JSON.parse(message);

      const timeoutId = setTimeout(() => {
        reply
          .code(404)
          .send();

        subscribe.off('message', listener);
      }, timeout);

      if (channel === 'getFrame:response' && data.id === id) {
        reply
          .type('image/png')
          .send(Buffer.from(data.frame));

        subscribe.off('message', listener);
        clearTimeout(timeoutId);
      }
    });

    return reply;
  };
}
