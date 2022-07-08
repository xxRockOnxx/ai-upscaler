import Redis from 'ioredis';
import createStore from './redis';
import { QueueStore, QueueError } from './store';

describe('queue', () => {
  let connection: Redis;
  let queue: QueueStore;

  beforeAll(async () => {
    connection = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      db: 1,
    });

    await new Promise((resolve) => {
      connection.on('connect', resolve);
    });

    await connection.flushdb();

    queue = createStore(connection);
  });

  afterAll(() => connection.quit());

  describe('join', () => {
    afterEach(() => connection.flushdb());

    it('should assign ready status if queue is empty', async () => {
      await queue.join('test-1-id');

      const list = await queue.getAll();

      expect(Object.keys(list)).toHaveLength(1);
      expect(list['test-1-id']).toHaveProperty('status', 'ready');
    });

    it("should assign ready status if there's no ongoing", async () => {
      await queue.join('test-1-id');
      await queue.markAsStatus('test-1-id', 'finished');

      await queue.join('test-2-id');

      const list = await queue.getAll();

      expect(Object.keys(list)).toHaveLength(2);
      expect(list['test-2-id']).toHaveProperty('status', 'ready');
      expect(list['test-2-id']).toHaveProperty('position', 1);
    });

    it("should assign waiting status if there's someone in the queue", async () => {
      await queue.join('test-1-id');
      await queue.join('test-2-id');

      const list = await queue.getAll();

      expect(Object.keys(list)).toHaveLength(2);

      expect(list['test-1-id']).toHaveProperty('status', 'ready');
      expect(list['test-1-id']).toHaveProperty('position', 1);

      expect(list['test-2-id']).toHaveProperty('status', 'waiting');
      expect(list['test-2-id']).toHaveProperty('position', 2);
    });

    it('should throw an error if the queue is already in an ongoing state', async () => {
      await queue.join('test-1-id');
      await expect(queue.join('test-1-id')).rejects.toThrow(QueueError);

      await queue.markAsStatus('test-1-id', 'waiting');
      await expect(queue.join('test-1-id')).rejects.toThrow(QueueError);

      await queue.markAsStatus('test-1-id', 'processing');
      await expect(queue.join('test-1-id')).rejects.toThrow(QueueError);
    });

    it('should throw an error if the queue is already in a final state', async () => {
      await queue.join('test-1-id');
      await queue.markAsStatus('test-1-id', 'failed');
      await expect(queue.join('test-1-id')).rejects.toThrow(QueueError);

      await queue.markAsStatus('test-1-id', 'finished');
      await expect(queue.join('test-1-id')).rejects.toThrow(QueueError);
    });

    it('should allow queue in a final state to be forced', async () => {
      await queue.join('test-1-id');
      await queue.markAsStatus('test-1-id', 'failed');
      await queue.join('test-1-id', true);

      const list = await queue.getAll();

      expect(Object.keys(list)).toHaveLength(1);
      expect(list['test-1-id']).toHaveProperty('status', 'ready');
    });
  });

  describe('refresh', () => {
    afterEach(() => connection.flushdb());

    it('should update updatedAt property', async () => {
      // Setup
      await queue.join('test-1-id');

      let list = await queue.getAll();
      const item = list['test-1-id'];
      const lastUpdatedAt = item.updatedAt;

      // Action
      // eslint-disable-next-line no-promise-executor-return
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await queue.refresh('test-1-id');

      // Assert
      list = await queue.getAll();
      const updatedItem = list['test-1-id'];

      expect(updatedItem.updatedAt.getTime()).toBeGreaterThan(lastUpdatedAt.getTime());
    });

    it('should throw an error if the queue item is not found', async () => {
      await expect(queue.refresh('test-1-id')).rejects.toThrow(QueueError);
    });

    it('should throw an error if the queue item is already in a final state', async () => {
      await queue.join('test-1-id');
      await queue.markAsStatus('test-1-id', 'failed');
      await expect(queue.refresh('test-1-id')).rejects.toThrow(QueueError);

      await queue.markAsStatus('test-1-id', 'finished');
      await expect(queue.refresh('test-1-id')).rejects.toThrow(QueueError);
    });
  });

  describe('markAsStatus', () => {
    afterEach(() => connection.flushdb());

    it('should update status property', async () => {
      await queue.join('test-1-id');
      await queue.markAsStatus('test-1-id', 'finished');

      const list = await queue.getAll();
      const updatedItem = list['test-1-id'];

      expect(updatedItem.status).toBe('finished');
    });

    it('should throw an error if the queue item is not found', async () => {
      await expect(queue.markAsStatus('test-1-id', 'finished')).rejects.toThrow(QueueError);
    });
  });

  describe('removeIfExpired', () => {
    afterEach(() => connection.flushdb());

    it('should remove queue in ongoing status after 1 minute', async () => {
      await queue.save('test-1-id', {
        status: 'processing',
        position: 1,
        updatedAt: new Date(Date.now() - (60 * 1000)),
      });

      await queue.save('test-2-id', {
        status: 'ready',
        position: 2,
        updatedAt: new Date(Date.now() - (60 * 1000)),
      });

      await queue.save('test-3-id', {
        status: 'waiting',
        position: 3,
        updatedAt: new Date(Date.now() - (60 * 1000)),
      });

      await queue.save('test-4-id', {
        status: 'waiting',
        position: 4,
        updatedAt: new Date(),
      });

      await queue.save('test-5-id', {
        status: 'waiting',
        position: 5,
        updatedAt: new Date(Date.now() - (60 * 1000)),
      });

      await expect(queue.removeIfExpired('test-1-id')).resolves.toBe(true);
      await expect(queue.removeIfExpired('test-2-id')).resolves.toBe(true);
      await expect(queue.removeIfExpired('test-3-id')).resolves.toBe(true);
      await expect(queue.removeIfExpired('test-4-id')).resolves.toBe(false);
      await expect(queue.removeIfExpired('test-5-id')).resolves.toBe(true);
    });

    it('should remove queue in final state after 1 hour', async () => {
      await queue.save('test-1-id', {
        status: 'finished',
        position: 1,
        updatedAt: new Date(Date.now() - (1000 * 60 * 60)),
      });

      await queue.save('test-2-id', {
        status: 'failed',
        position: 1,
        updatedAt: new Date(Date.now() - (1000 * 60 * 60)),
      });

      await queue.save('test-3-id', {
        status: 'finished',
        position: 1,
        updatedAt: new Date(),
      });

      await queue.save('test-4-id', {
        status: 'failed',
        position: 1,
        updatedAt: new Date(),
      });

      await expect(queue.removeIfExpired('test-1-id')).resolves.toBe(true);
      await expect(queue.removeIfExpired('test-2-id')).resolves.toBe(true);
      await expect(queue.removeIfExpired('test-3-id')).resolves.toBe(false);
      await expect(queue.removeIfExpired('test-4-id')).resolves.toBe(false);
    });

    it('should not throw an error if the queue item is not found', async () => {
      await expect(queue.removeIfExpired('test-1-id')).resolves.toBe(true);
    });
  });

  describe('sort', () => {
    afterEach(() => connection.flushdb());

    it('should sort the queue items by position', async () => {
      // Simulate queue state after removing an expired item.
      await queue.save('test-2-id', {
        status: 'waiting',
        position: 2,
        updatedAt: new Date(),
      });

      await queue.save('test-3-id', {
        status: 'waiting',
        position: 3,
        updatedAt: new Date(),
      });

      // Simulate there was position 4 but did not update and was expired.
      // We save position 5 instead.

      await queue.save('test-5-id', {
        status: 'waiting',
        position: 5,
        updatedAt: new Date(),
      });

      await queue.sort();

      const list = await queue.getAll();

      expect(list['test-2-id'].position).toBe(1);
      expect(list['test-2-id'].status).toBe('ready');

      expect(list['test-3-id'].position).toBe(2);
      expect(list['test-3-id'].status).toBe('waiting');

      expect(list['test-5-id'].position).toBe(3);
      expect(list['test-5-id'].status).toBe('waiting');
    });
  });
});
