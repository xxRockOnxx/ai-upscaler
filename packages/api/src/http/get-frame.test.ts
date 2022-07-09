import fs from 'fs';
import path from 'path';
import fastify from 'fastify';
import cookies from '@fastify/cookie';
import handler from './get-frame';

describe('get-frame', () => {
  it('should return 404 if directory/file does not exists', async () => {
    const app = fastify();

    await app.register(cookies);

    app.get('/frames/:frame', handler({
      async getFrameStream(id, frame, enhanced) {
        return undefined;
      },
    }));

    const response = await app.inject({
      method: 'GET',
      url: '/frames/anything',
      cookies: {
        queue: 'test',
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 200', async () => {
    const app = fastify();
    const getFrameStream = jest.fn().mockResolvedValue(fs.createReadStream(path.join(__dirname, '__tests__', 'image.jpg')));

    await app.register(cookies);

    app.get('/frames/:frame', handler({
      getFrameStream,
    }));

    const rawResponse = await app.inject({
      method: 'GET',
      url: '/frames/anything',
      cookies: {
        queue: 'test',
      },
    });

    expect(rawResponse.statusCode).toBe(200);
    expect(rawResponse.headers['content-type']).toBe('image/png');
    expect(getFrameStream).toBeCalledWith('test', 'anything', false);

    const enhancedResponse = await app.inject({
      method: 'GET',
      url: '/frames/anything?enhanced=true',
      cookies: {
        queue: 'test',
      },
    });

    expect(enhancedResponse.statusCode).toBe(200);
    expect(enhancedResponse.headers['content-type']).toBe('image/png');
    expect(getFrameStream).toHaveBeenNthCalledWith(2, 'test', 'anything', true);
  });
});
