import { JobStore } from '@ai-upscaler/core/src/jobs/store';
import { Storage } from '@ai-upscaler/core/src/storage/storage';
import { RouteHandler } from 'fastify';

interface GetDownloadOptions {
  downloads: Storage
  jobs: JobStore
}

export default function createGetDownload({
  downloads,
  jobs,
}: GetDownloadOptions): RouteHandler {
  return async function getDownload(request, reply) {
    const id = request.cookies.queue;
    const jobId = await jobs.get(id);

    try {
      const file = await downloads.get(jobId);
      return reply
        .header('Content-Type', 'video/mp4')
        .header('Content-Disposition', 'attachment; filename="enhanced.mp4"')
        .send(file);
    } catch (e) {
      console.error(e);

      return reply
        .code(404)
        .send(e.message);
    }
  };
}
