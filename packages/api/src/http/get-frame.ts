import { RouteHandler as BaseRouteHandler } from 'fastify';
import { JobStore } from '@ai-upscaler/core/src/jobs/store';
import { FrameStorage } from '@ai-upscaler/core/src/storage/storage';

type RouteHandler = BaseRouteHandler<{
  Querystring: {
    enhanced: string
  },
  Params: {
    frame: string
  }
}>

interface GetFrameOptions {
  jobs: JobStore
  createStorage(id: string): FrameStorage
}

export default function createGetFrame({
  jobs,
  createStorage,
}: GetFrameOptions): RouteHandler {
  return async function getFrame(request, reply) {
    const id = request.cookies.queue;
    const enhanced = request.query.enhanced === 'true';
    const { frame } = request.params;

    const job = await jobs.get(id);

    if (!job) {
      return reply
        .code(400)
        .send({
          message: 'Job not found',
        });
    }

    const storage = createStorage(job);
    const stream = await storage.getFrame(frame, enhanced);

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
