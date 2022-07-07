import { JobStore } from '@ai-upscaler/core/src/jobs/store';
import { FrameStorage } from '@ai-upscaler/core/src/storage/storage';
import { RouteHandler } from 'fastify';

interface GetFramesOptions {
  jobs: JobStore
  createStorage(id: string): FrameStorage
}

export default function createGetFrames({
  jobs,
  createStorage,
}: GetFramesOptions): RouteHandler {
  return async function getFrames(request, reply) {
    const id = request.cookies.queue;
    const job = await jobs.get(id);

    if (!job) {
      return reply
        .code(400)
        .send({
          message: 'Job not found',
        });
    }

    const storage = createStorage(job);
    const frames = await storage.getFrames(true);

    return reply.send(frames);
  };
}
