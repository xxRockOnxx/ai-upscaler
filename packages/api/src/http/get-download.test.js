const fastify = require('fastify');
const cookies = require('@fastify/cookie');
const path = require('path');
const fs = require('fs');
const handler = require('./get-download');

describe('get-frame', () => {
  /**
   * @type {fastify.FastifyInstance}
   */
  let app;
  const downloadsDB = {};

  beforeAll(async () => {
    app = fastify();
    await app.register(cookies);
    app.get('/download', handler(downloadsDB));
  });

  it('should return 404 if not in database', async () => {
    downloadsDB.getById = jest.fn(() => Promise.resolve(null));

    const response = await app.inject({
      method: 'GET',
      url: '/download',
      cookies: {
        queue: 'test',
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 410 if expired', async () => {
    const download = {
      expire_at: Date.now() - 1000,
      file: '/this/should/not/matter',
    };

    downloadsDB.getById = jest.fn(() => Promise.resolve(download));

    const response = await app.inject({
      method: 'GET',
      url: '/download',
      cookies: {
        queue: 'test',
      },
    });

    expect(response.statusCode).toBe(410);
  });

  it('should return a stream', async () => {
    const download = {
      expire_at: Date.now() + 5000,
      file: path.join(__dirname, '__tests__', 'video.mp4'),
    };

    downloadsDB.getById = jest.fn(() => Promise.resolve(download));
    downloadsDB.set = jest.fn();

    const response = await app.inject({
      method: 'GET',
      url: '/download',
      cookies: {
        queue: 'test',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('video/mp4');
    expect(response.headers['content-length']).toBe(fs.statSync(download.file).size);
  });
});
