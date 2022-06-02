const fastify = require('fastify');
const cookies = require('@fastify/cookie');
const fs = require('fs-extra');
const handler = require('./get-frame');
const Storage = require('../storage');

describe('get-frame', () => {
  /**
   * @type {fastify.FastifyInstance}
   */
  let app;

  beforeAll(async () => {
    app = fastify();
    await app.register(cookies);
    app.get("/frames/:frame", handler());
  });

  it("should return 404 if directory/file does not exists", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/frames/frame.png",
    });

    expect(response.statusCode).toBe(404);
  });

  it("should return 200", async () => {
    const storage = new Storage("test");

    try {
      await storage.initialize();
      await storage.mkdir('frames');
      await fs.copy(__dirname + '/__tests__/image.jpg', storage.path('frames/frame.png'));

      const response = await app.inject({
        method: "GET",
        url: "/frames/frame.png",
        cookies: {
          queue: "test",
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("image/png");
    } finally {
      await storage.destroy();
    }
  })
})
