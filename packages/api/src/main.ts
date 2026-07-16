import createServer from './server';
import assertRequiredEnv from './env';
import { createDependencies } from './deps';
import registerRoutes from './routes';

assertRequiredEnv();

async function start() {
  const deps = await createDependencies();
  const server = await createServer();

  registerRoutes(server, deps);

  // Sweep expired queue entries at boot and periodically afterwards,
  // so cleanup does not depend on the process being restarted.
  await deps.queue.removeExpired();

  setInterval(() => {
    deps.queue.removeExpired().catch((error) => {
      server.log.error(error, 'Failed to remove expired queue entries');
    });
  }, 60_000).unref();

  await server.listen(3000, '0.0.0.0');
}

start();
