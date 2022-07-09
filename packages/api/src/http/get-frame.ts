import { RouteHandler as BaseRouteHandler } from 'fastify';
import { Readable } from 'stream';

type RouteHandler = BaseRouteHandler<{
  Querystring: {
    enhanced: string
  },
  Params: {
    frame: string
  }
}>

interface GetFrameOptions {
  getFrameStream(id: string, frame: string, enhanced: boolean): Promise<Readable | undefined>
}

export default function createGetFrame({ getFrameStream }: GetFrameOptions): RouteHandler {
  return async function getFrame(request, reply) {
    const id = request.cookies.queue;
    const enhanced = request.query.enhanced === 'true';
    const { frame } = request.params;
    const stream = await getFrameStream(id, frame, enhanced);

    if (!stream) {
      return reply
        .code(404)
        .send();
    }

    return reply
      .type('image/png')
      .send(stream);
  };
}
