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
  // so cleanup does not depend on in-process timers or restarts.
  // When entries are removed we re-sort the waiting queue and cancel
  // any job that was still running for a removed entry.
  const sweepExpired = async () => {
    const removed = await deps.queue.removeExpired();

    if (removed.length === 0) {
      return;
    }

    await deps.queue.sortWaiting();

    await Promise.all(removed.map(async (id) => {
      const job = await deps.jobs.get(id);

      if (job) {
        await deps.redisDB.publish('cancel', JSON.stringify({ id: job }));
      }
    }));
  };

  await sweepExpired();

  setInterval(() => {
    sweepExpired().catch((error) => {
      server.log.error(error, 'Failed to sweep expired queue entries');
    });
  }, 60_000).unref();

  await server.listen(3000, '0.0.0.0');
}

start();
