const { createClient } = require('redis');
const createQueue = require('./queue');
const { QueueError } = require('./queue');

describe('queue', () => {
  let connection;
  let queue;

  beforeAll(async () => {
    connection = createClient({
      url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    });

    queue = createQueue(connection);

    await connection.connect();
    await connection.select(1);
    await connection.flushDb();
  });

  afterAll(() => connection.quit());

  describe('join', () => {
    afterEach(() => connection.flushDb());

    it("should assign ready status if there's no one in the queue", async () => {
      await queue.join('test-1-id');

      const list = await queue.getAll();

      expect(Object.keys(list)).toHaveLength(1);
      expect(list['test-1-id']).toHaveProperty('status', 'ready');
    });

    it("should assign waiting status if there's someone in the queue", async () => {
      await queue.join('test-1-id');
      await queue.join('test-2-id');

      const list = await queue.getAll();

      expect(Object.keys(list)).toHaveLength(2);
      expect(list['test-2-id']).toHaveProperty('status', 'waiting');
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
    afterEach(() => connection.flushDb());

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

      expect(updatedItem.updatedAt).toBeGreaterThan(lastUpdatedAt);
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
    afterEach(() => connection.flushDb());

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
    afterEach(() => connection.flushDb());

    it('should remove queue in ongoing status after 1 minute', async () => {
      await queue.save('test-1-id', {
        status: 'ready',
        position: 1,
        updatedAt: new Date(Date.now() - (60 * 1000)),
      });

      await queue.save('test-2-id', {
        status: 'waiting',
        position: 2,
        updatedAt: new Date(),
      });

      await expect(queue.removeIfExpired('test-1-id')).resolves.toBe(true);
      await expect(queue.removeIfExpired('test-2-id')).resolves.toBe(false);
    });

    it('should remove queue in final state after 1 hour', async () => {
      await queue.save('test-1-id', {
        status: 'finished',
        position: 1,
        updatedAt: new Date(Date.now() - (1000 * 60 * 60)),
      });

      await queue.save('test-2-id', {
        status: 'finished',
        position: 2,
        updatedAt: new Date(),
      });

      await expect(queue.removeIfExpired('test-1-id')).resolves.toBe(true);
      await expect(queue.removeIfExpired('test-2-id')).resolves.toBe(false);
    });

    it('should not throw an error if the queue item is not found', async () => {
      await expect(queue.removeIfExpired('test-1-id')).resolves.toBe(true);
    });
  });

  describe('sort', () => {
    afterEach(() => connection.flushDb());

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

      await queue.sort();

      const list = await queue.getAll();

      expect(list['test-2-id'].position).toBe(1);
      expect(list['test-2-id'].status).toBe('ready');

      expect(list['test-3-id'].position).toBe(2);
      expect(list['test-3-id'].status).toBe('waiting');
    });
  });
});
