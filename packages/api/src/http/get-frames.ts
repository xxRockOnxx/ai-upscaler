import { Queue, QueueEvents, QueueEventsListener } from 'bullmq';
import { RouteHandler } from 'fastify';

interface GetFramesOptions {
  commandQueue: Queue
  commandEvents: QueueEvents
}

export default function createGetFrames({
  commandQueue,
  commandEvents,
}: GetFramesOptions): RouteHandler {
  return async function getFrames(request, reply) {
    const id = request.cookies.queue;
    const job = await commandQueue.add('getFrames', { id });

    const completeListener: QueueEventsListener['completed'] = function completeListener(job2) {
      if (job.id === job2.jobId) {
        commandEvents
          .off('completed', completeListener)
          // eslint-disable-next-line no-use-before-define
          .off('failed', failedListener);

        reply
          .send(job2.returnvalue);
      }
    };

    const failedListener: QueueEventsListener['failed'] = function failedListener(job2) {
      if (job.id === job2.jobId) {
        commandEvents
          .off('completed', completeListener)
          .off('failed', failedListener);

        reply
          .code(500)
          .send();
      }
    };

    commandEvents
      .on('completed', completeListener)
      .on('failed', failedListener);

    return reply;
  };
}
