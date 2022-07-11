import { Queue } from 'bullmq';
import { RouteHandler as BaseRouteHandler } from 'fastify';

type RouteHandler = BaseRouteHandler<{
  Params: {
    job: string
  }
}>

interface GetProgressOptions {
  bull: Queue
}

export default function createGetProgress({ bull }: GetProgressOptions): RouteHandler {
  return async function getProgress(request, reply) {
    const jobId = request.params.job;

    if (!jobId) {
      return reply
        .code(400)
        .send({
          message: 'Missing job id',
        });
    }

    const job = await bull.getJob(jobId);

    if (!job) {
      return reply
        .code(404)
        .send({
          message: 'Job not found',
        });
    }

    if (job.data.user !== request.cookies.queue) {
      return reply
        .code(401)
        .send({
          message: 'Job does not belong to this queue',
        });
    }

    return reply.send(job.progress);
  };
}
