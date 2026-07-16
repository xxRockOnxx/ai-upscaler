import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import fastify, { FastifyInstance } from 'fastify';
import cookies from '@fastify/cookie';
import multipart from '@fastify/multipart';
// Test-only dependency, resolved transitively; never shipped.
// eslint-disable-next-line import/no-extraneous-dependencies, node/no-unpublished-import
import FormData from 'form-data';
import { Queue } from 'bullmq';
import { QueueStore } from '@ai-upscaler/core/src/queue/store';
import { JobStore } from '@ai-upscaler/core/src/jobs/store';
import { LocalStorage } from '@ai-upscaler/core/src/storage/local';
import { Storage } from '@ai-upscaler/core/src/storage/storage';
import handler from './post-submit';

function fixture(name: string): string {
  return path.join(__dirname, '__tests__', name);
}

describe('post-submit', () => {
  let app: FastifyInstance;
  let currentFixture: string;

  const queue = {
    get: jest.fn(),
    markAsStatus: jest.fn().mockResolvedValue(undefined),
  };

  const jobs = {
    save: jest.fn().mockResolvedValue(undefined),
  };

  const bull = {
    add: jest.fn(),
  };

  const tmpStorage = {
    store: jest.fn(async (id: string, stream: Readable) => {
      stream.resume();
      await new Promise((resolve) => {
        stream.on('end', resolve);
      });
    }),
    path: jest.fn(() => currentFixture),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const uploadStorage = {
    store: jest.fn(async (id: string, stream: Readable) => {
      stream.resume();
      await new Promise((resolve) => {
        stream.on('end', resolve);
      });
    }),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  function readyQueueItem() {
    return {
      position: 1,
      status: 'ready',
      updatedAt: new Date(),
    };
  }

  function submit(name?: string, processor?: string, interpolation?: string) {
    const data = new FormData();

    // Sent before the file so it is parsed as a field alongside the file part.
    if (processor) {
      data.append('processor', processor);
    }

    if (interpolation) {
      data.append('interpolation', interpolation);
    }

    if (name) {
      currentFixture = fixture(name);
      data.append('file', fs.createReadStream(currentFixture));
    }

    return app.inject({
      method: 'POST',
      url: '/submit',
      headers: data.getHeaders(),
      payload: data,
      cookies: {
        queue: 'test-id',
      },
    });
  }

  beforeAll(async () => {
    app = fastify();
    await app.register(cookies);
    await app.register(multipart);
    app.post('/submit', handler({
      queue: queue as unknown as QueueStore,
      jobs: jobs as unknown as JobStore,
      bull: bull as unknown as Queue,
      tmpStorage: tmpStorage as unknown as LocalStorage,
      uploadStorage: uploadStorage as unknown as Storage,
    }));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    queue.get.mockResolvedValue(readyQueueItem());
  });

  it('should return 415 if not multipart', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/submit',
      cookies: {
        queue: 'test-id',
      },
    });

    expect(response.statusCode).toBe(415);
  });

  it('should return 400 if missing `file`', async () => {
    const data = new FormData();

    data.append('wrong_field', fs.createReadStream(fixture('image.jpg')));

    const response = await app.inject({
      method: 'POST',
      url: '/submit',
      headers: data.getHeaders(),
      payload: data,
      cookies: {
        queue: 'test-id',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 if not ready', async () => {
    queue.get.mockResolvedValue({
      position: 2,
      status: 'waiting',
      updatedAt: new Date(),
    });

    const response = await submit('video.mp4');

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe('Waiting turn');
  });

  it('should return 400 if already processing', async () => {
    queue.get.mockResolvedValue({
      position: 1,
      status: 'processing',
      updatedAt: new Date(),
    });

    const response = await submit('video.mp4');

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe('Already processing');
  });

  it('should return 400 if invalid file', async () => {
    const response = await submit('image.jpg');

    expect(response.statusCode).toBe(400);
    expect(tmpStorage.delete).toBeCalledWith('test-id');
    expect(queue.markAsStatus).toHaveBeenLastCalledWith('test-id', 'ready');
  });

  it('should return 400 if video limit exceeded', async () => {
    const response = await submit('invalid-video.mp4');

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty('errors');
    expect(tmpStorage.delete).toBeCalledWith('test-id');
    expect(queue.markAsStatus).toHaveBeenLastCalledWith('test-id', 'ready');
  });

  it('should claim the queue slot before storing the upload', async () => {
    bull.add.mockResolvedValue({ id: 'job-123' });

    let claimedBeforeStore: boolean;
    tmpStorage.store.mockImplementationOnce(async (id: string, stream: Readable) => {
      claimedBeforeStore = queue.markAsStatus.mock.calls.length > 0;
      stream.resume();
      await new Promise((resolve) => {
        stream.on('end', resolve);
      });
    });

    await submit('video.mp4');

    expect(claimedBeforeStore).toBe(true);
    expect(queue.markAsStatus).toBeCalledWith('test-id', 'processing');
  });

  it('should return 500 and release the claim if failed to add to queue', async () => {
    bull.add.mockRejectedValue(new Error('Test error'));

    const response = await submit('video.mp4');

    expect(response.statusCode).toBe(500);
    expect(uploadStorage.delete).toBeCalledWith('test-id');
    expect(queue.markAsStatus).toHaveBeenLastCalledWith('test-id', 'ready');
  });

  it('should remove the bull job if saving the job id fails', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    bull.add.mockResolvedValue({ id: 'job-123', remove });
    jobs.save.mockRejectedValueOnce(new Error('Test error'));

    const response = await submit('video.mp4');

    expect(response.statusCode).toBe(500);
    expect(remove).toBeCalled();
    expect(uploadStorage.delete).toBeCalledWith('test-id');
    expect(queue.markAsStatus).toHaveBeenLastCalledWith('test-id', 'ready');
  });

  it('should return 201 with the job id on success', async () => {
    bull.add.mockResolvedValue({ id: 'job-123' });

    const response = await submit('video.mp4');

    expect(response.statusCode).toBe(201);
    expect(response.json().job).toBe('job-123');
    expect(queue.markAsStatus).toBeCalledWith('test-id', 'processing');
    expect(queue.markAsStatus).not.toBeCalledWith('test-id', 'ready');
    expect(jobs.save).toBeCalledWith('test-id', 'job-123');
  });

  it('should forward the selected processor to the job', async () => {
    bull.add.mockResolvedValue({ id: 'job-123' });

    await submit('video.mp4', 'waifu2x');

    expect(bull.add).toBeCalledWith('upscale', {
      user: 'test-id',
      processor: 'waifu2x',
      interpolation: 'none',
    });
  });

  it('should default the processor when none or an invalid one is given', async () => {
    bull.add.mockResolvedValue({ id: 'job-123' });

    await submit('video.mp4', 'not-a-real-processor');

    expect(bull.add).toBeCalledWith('upscale', {
      user: 'test-id',
      processor: 'real-esrgan',
      interpolation: 'none',
    });
  });

  it('should forward the selected interpolation to the job', async () => {
    bull.add.mockResolvedValue({ id: 'job-123' });

    await submit('video.mp4', 'waifu2x', 'cain');

    expect(bull.add).toBeCalledWith('upscale', {
      user: 'test-id',
      processor: 'waifu2x',
      interpolation: 'cain',
    });
  });

  it('should default the interpolation when an invalid one is given', async () => {
    bull.add.mockResolvedValue({ id: 'job-123' });

    await submit('video.mp4', undefined, 'not-a-real-interpolation');

    expect(bull.add).toBeCalledWith('upscale', {
      user: 'test-id',
      processor: 'real-esrgan',
      interpolation: 'none',
    });
  });
});
