import fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';

export default async function createServer() {
  const server = fastify({
    logger: {
      level: 'info',
      prettyPrint: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
    disableRequestLogging: true,
  });

  await server.register(fastifyCookie, {
    secret: process.env.APP_SECRET,
    parseOptions: {
      signed: true,
    },
  });

  await server.register(fastifyMultipart, {
    limits: {
      files: 1,

      // This is equal to 5MB
      fileSize: 5 * 1000000,
    },
  });

  // Automatically unsign queue cookie for convenience.
  server.addHook('preHandler', async (req, reply) => {
    if (!req.cookies.queue) {
      return;
    }

    const { valid, value } = req.unsignCookie(req.cookies.queue);

    if (!valid) {
      // A failed signature check means the cookie is tampered or was signed
      // with a rotated secret. Without this, the raw signed blob flows into
      // handlers as if it were a queue id, and the client keeps re-sending
      // the dead cookie on every request. Drop it on both sides.
      delete req.cookies.queue;
      reply.clearCookie('queue', { httpOnly: true });
      return;
    }

    req.cookies.queue = value;
  });

  return server;
}
