import { Readable } from 'stream';
import { RouteHandler } from 'fastify';

interface GetDownloadOptions {
  getDownloadFile(id: string): Promise<Readable | undefined>
}

export default function createGetDownload({ getDownloadFile }: GetDownloadOptions): RouteHandler {
  return async function getDownload(request, reply) {
    const id = request.cookies.queue;
    const file = await getDownloadFile(id);

    if (!file) {
      return reply
        .code(404)
        .send({
          message: 'No downloadable file found',
        });
    }

    return reply
      .header('Content-Type', 'video/mp4')
      .header('Content-Disposition', 'attachment; filename="enhanced.mp4"')
      .send(file);
  };
}
