import { RouteHandler } from 'fastify';

interface GetFramesOptions {
  getFramesProcessed(id): Promise<number>
}

export default function createGetFrames({ getFramesProcessed }: GetFramesOptions): RouteHandler {
  return async function getFrames(request, reply) {
    const id = request.cookies.queue;

    return reply.send({
      frames: await getFramesProcessed(id),
    });
  };
}
