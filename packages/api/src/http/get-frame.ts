import { Queue, QueueEvents, QueueEventsListener } from 'bullmq';
import { RouteHandler as BaseRouteHandler } from 'fastify';

type RouteHandler = BaseRouteHandler<{
  Querystring: {
    enhanced: string
  },
  Params: {
    frame: string
  }
}>

interface GetFrameOptions {
  commandQueue: Queue
  commandEvents: QueueEvents
}

export default function createGetFrame({
  commandQueue,
  commandEvents,
}: GetFrameOptions): RouteHandler {
  return async function getFrame(request, reply) {
    const id = request.cookies.queue;
    const enhanced = request.query.enhanced === 'true';
    const job = await commandQueue.add('getFrame', {
      id,
      enhanced,
      frame: request.params.frame,
    });

    const completeListener: QueueEventsListener['completed'] = function completeListener(job2) {
      if (job.id === job2.jobId) {
        commandEvents
          .off('completed', completeListener)
          // eslint-disable-next-line no-use-before-define
          .off('failed', failedListener);

        reply
          .type('image/png')
          .send(Buffer.from((job2.returnvalue as unknown as { data: number[]}).data));
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
