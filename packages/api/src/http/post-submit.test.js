const fastify = require('fastify');
const cookies = require('@fastify/cookie');
const multipart = require('@fastify/multipart');
const fs = require('fs');
const FormData = require('form-data');
const handler = require('./post-submit');

const queue = {};
const upscaler = {};

describe('post-submit', () => {
  /**
   * @type {fastify.FastifyInstance}
   */
  let app;

  beforeAll(async () => {
    app = fastify();
    await app.register(cookies);
    await app.register(multipart);
    app.post('/submit', handler(queue, upscaler));
  });

  it('should return 415 if not multipart', async () => {
    queue.getAll = jest.fn().mockResolvedValue({
      'test-id': {
        position: 1,
        status: 'ready',
        updatedAt: new Date(),
      },
    });

    // By default, request will be JSON
    const response = await app.inject({
      method: 'POST',
      url: '/submit',
      cookies: {
        queue: 'test-id',
      },
    });

    expect(response.statusCode).toBe(415);
  });

  it('should return 400 if not ready', async () => {
    queue.getAll = jest.fn().mockResolvedValue({
      'test-id': {
        position: 2,
        status: 'waiting',
        updatedAt: new Date(),
      },
    });

    const data = new FormData();

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

  it('should return 400 if already processing', async () => {
    queue.getAll = jest.fn().mockResolvedValue({
      'test-id': {
        position: 1,
        status: 'processing',
        updatedAt: new Date(),
      },
    });

    const data = new FormData();

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

  it('should return 400 if missing `file`', async () => {
    queue.getAll = jest.fn().mockResolvedValue({
      'test-id': {
        position: 1,
        status: 'ready',
        updatedAt: new Date(),
      },
    });

    const data = new FormData();

    data.append('wrong_field', fs.createReadStream(`${__dirname}/__tests__/image.jpg`));

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

  it('should return 400 if invalid file', async () => {
    queue.getAll = jest.fn().mockResolvedValue({
      'test-id': {
        position: 1,
        status: 'ready',
        updatedAt: new Date(),
      },
    });

    const data = new FormData();

    data.append('file', fs.createReadStream(`${__dirname}/__tests__/image.jpg`));

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

  it('should return 400 if video limit exceeded', async () => {
    queue.getAll = jest.fn().mockResolvedValue({
      'test-id': {
        position: 1,
        status: 'ready',
        updatedAt: new Date(),
      },
    });

    const data = new FormData();

    data.append('file', fs.createReadStream(`${__dirname}/__tests__/invalid-video.mp4`));

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
    expect(response.json()).toHaveProperty('errors');
  });

  it('should return 500 if failed to add to queue', async () => {
    queue.getAll = jest.fn().mockResolvedValue({
      'test-id': {
        position: 1,
        status: 'ready',
        updatedAt: new Date(),
      },
    });

    upscaler.add = jest.fn().mockRejectedValue(new Error('Test error'));

    const data = new FormData();

    data.append('file', fs.createReadStream(`${__dirname}/__tests__/video.mp4`));

    const response = await app.inject({
      method: 'POST',
      url: '/submit',
      headers: data.getHeaders(),
      payload: data,
      cookies: {
        queue: 'test-id',
      },
    });

    expect(response.statusCode).toBe(500);
  });
});
