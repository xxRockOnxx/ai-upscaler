import { Queue } from 'bullmq';
import fastify from 'fastify';
import handler from './get-availability';

function mockQueue(workers: unknown[]): Queue {
  return {
    getWorkers: jest.fn().mockResolvedValue(workers),
  } as unknown as Queue;
}

describe('get-availability', () => {
  it('should return true if there is a worker', async () => {
    const app = fastify().get('/availability', handler({
      queue: mockQueue([{ id: 'worker-1' }]),
    }));

    const response = await app.inject({
      method: 'GET',
      url: '/availability',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().available).toBe(true);
  });

  it('should return false if there is no worker', async () => {
    const app = fastify().get('/availability', handler({
      queue: mockQueue([]),
    }));

    const response = await app.inject({
      method: 'GET',
      url: '/availability',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().available).toBe(false);
  });
});
