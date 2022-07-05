import { Queue, Worker } from 'bullmq';
import fastify from 'fastify';
import Redis from 'ioredis';
import handler from './get-availability';

describe('get-availability', () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      maxRetriesPerRequest: null,
    });
  });

  afterAll(() => redis.quit());

  it('should return true if there is a worker', async () => {
    const queue = new Queue('true', {
      connection: redis,
    });

    const worker = new Worker('true', async () => undefined, { connection: redis });

    await queue.waitUntilReady();
    await worker.waitUntilReady();

    const app = fastify().get('/availability', handler({ queue }));

    const response = await app.inject({
      method: 'GET',
      url: '/availability',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().available).toBe(true);

    await worker.close();
    await queue.close();
  });

  it('should return false if there is no worker', async () => {
    const queue = new Queue('false', {
      connection: redis,
    });

    await queue.waitUntilReady();

    const app = fastify().get('/availability', handler({ queue }));

    const response = await app.inject({
      method: 'GET',
      url: '/availability',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().available).toBe(false);

    await queue.close();
  });
});
