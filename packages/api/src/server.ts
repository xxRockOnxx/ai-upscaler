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
  server.addHook('preHandler', async (req) => {
    if (!req.cookies.queue) {
      return;
    }

    const { valid, value } = req.unsignCookie(req.cookies.queue);

    if (!valid) {
      return;
    }

    req.cookies.queue = value;
  });

  return server;
}
