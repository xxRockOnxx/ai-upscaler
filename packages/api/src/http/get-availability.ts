import { Queue } from 'bullmq';
import { RouteHandler } from 'fastify';

interface GetAvailabilityOptions {
  queue: Queue
}

export default function createGetAvailability({ queue }: GetAvailabilityOptions): RouteHandler {
  return async function getAvailability(request, reply) {
    const workers = await queue.getWorkers();

    return reply.send({
      available: workers.length > 0,
    });
  };
}
