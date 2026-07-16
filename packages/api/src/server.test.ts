import createServer from './server';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const createSigner = require('@fastify/cookie/signer');

const SECRET = 'test-secret-test-secret-test-secret';

describe('server queue-cookie hook', () => {
  let server: Awaited<ReturnType<typeof createServer>>;
  const signer = createSigner(SECRET);

  beforeAll(async () => {
    process.env.APP_SECRET = SECRET;
    server = await createServer();

    server.get('/echo', async (req) => ({
      queue: req.cookies.queue ?? null,
    }));
  });

  afterAll(async () => {
    await server.close();
  });

  it('should unsign a valid queue cookie', async () => {
    const signed = signer.sign('some-queue-id');

    const response = await server.inject({
      method: 'GET',
      url: '/echo',
      cookies: { queue: signed },
    });

    expect(response.json()).toEqual({ queue: 'some-queue-id' });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('should drop and clear a tampered queue cookie', async () => {
    const tampered = `${signer.sign('some-queue-id')}garbage`;

    const response = await server.inject({
      method: 'GET',
      url: '/echo',
      cookies: { queue: tampered },
    });

    // The handler must never see the raw signed blob.
    expect(response.json()).toEqual({ queue: null });

    // The client must be told to stop sending the dead cookie.
    const setCookies = response.cookies as Array<{ name: string, value: string }>;
    expect(setCookies.some((c) => c.name === 'queue' && c.value === '')).toBe(true);
  });

  it('should pass requests without a queue cookie through untouched', async () => {
    const response = await server.inject({ method: 'GET', url: '/echo' });

    expect(response.json()).toEqual({ queue: null });
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
