import fastify from 'fastify';
import cookies from '@fastify/cookie';
import handler from './get-frames';

describe('get-frames', () => {
  it('should return number of processed frames', async () => {
    const app = fastify().register(cookies);

    const getFramesProcessed = jest.fn(() => Promise.resolve(10));

    app.get('/frames', handler({
      getFramesProcessed,
    }));

    const response = await app.inject({
      method: 'GET',
      url: '/frames',
      cookies: {
        queue: 'queue-id',
      },
    });

    expect(getFramesProcessed).toHaveBeenCalledWith('queue-id');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      frames: 10,
    });
  });
});
