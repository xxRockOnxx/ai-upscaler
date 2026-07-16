import fs from 'fs';
import path from 'path';
import fastify from 'fastify';
import cookies from '@fastify/cookie';
import handler from './get-download';

describe('get-download', () => {
  it('should return 404 if there is no downloadable file', async () => {
    const app = fastify();

    await app.register(cookies);

    app.get('/download', handler({
      getDownloadFile: jest.fn().mockResolvedValue(undefined),
    }));

    const response = await app.inject({
      method: 'GET',
      url: '/download',
      cookies: {
        queue: 'test',
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return the file as an attachment stream', async () => {
    const app = fastify();
    const file = path.join(__dirname, '__tests__', 'video.mp4');
    const getDownloadFile = jest.fn().mockResolvedValue(fs.createReadStream(file));

    await app.register(cookies);

    app.get('/download', handler({
      getDownloadFile,
    }));

    const response = await app.inject({
      method: 'GET',
      url: '/download',
      cookies: {
        queue: 'test',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('video/mp4');
    expect(response.headers['content-disposition']).toBe('attachment; filename="enhanced.mp4"');
    expect(getDownloadFile).toBeCalledWith('test');
    expect(response.rawPayload.length).toBe(fs.statSync(file).size);
  });
});
