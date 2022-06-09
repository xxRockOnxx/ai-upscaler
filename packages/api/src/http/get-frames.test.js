const fastify = require('fastify');
const cookies = require('@fastify/cookie');
const fs = require('fs-extra');
const handler = require('./get-frames');
const Storage = require('../storage');

describe('get-frames', () => {
  /**
   * @type {fastify.FastifyInstance}
   */
  let app;

  beforeAll(async () => {
    app = fastify();
    await app.register(cookies);
    app.get('/frames', handler());
  });

  it('should return empty array if directory/file does not exists', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/frames',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual([]);
  });

  it('should return array of enhanced frames', async () => {
    const storage = new Storage('test');

    try {
      await storage.initialize();
      await storage.mkdir('enhanced_frames');
      await fs.copy(
        `${__dirname}/__tests__/image.jpg`,
        storage.path('enhanced_frames/frame.png'),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/frames',
        cookies: {
          queue: 'test',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(['frame.png']);
    } finally {
      await storage.destroy();
    }
  });
});
