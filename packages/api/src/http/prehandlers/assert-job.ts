import { JobStore } from '@ai-upscaler/core/src/jobs/store';
import { preHandlerAsyncHookHandler } from 'fastify';

// eslint-disable-next-line import/prefer-default-export
export function createAssertJob(job: JobStore): preHandlerAsyncHookHandler {
  return async function assertJob(request, reply) {
    const jobId = await job.get(request.cookies.queue);

    if (!jobId) {
      reply
        .code(400)
        .send({
          message: 'Current request has no job',
        });
    }
  };
}
