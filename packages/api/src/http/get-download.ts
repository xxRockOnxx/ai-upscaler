import { DownloadStore } from '@ai-upscaler/core/src/downloads/store';
import { Storage } from '@ai-upscaler/core/src/storage/storage';
import { RouteHandler } from 'fastify';

interface GetDownloadOptions {
  downloads: Storage
}

export default function createGetDownload({
  downloads,
}: GetDownloadOptions): RouteHandler {
  return async function getDownload(request, reply) {
    const id = request.cookies.queue;

    try {
      const file = await downloads.get(id);
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
