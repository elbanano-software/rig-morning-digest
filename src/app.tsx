import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight, type DigestNight } from './digest/types.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

function isNightName(night: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(night);
}

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!isNightName(night)) {
      return c.json({ error: 'Night not found' }, 404);
    }

    try {
      const { rows, badLines } = readNight(config.runsDir, night);
      return c.json({ rows, badLines });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return c.json({ error: 'Night not found' }, 404);
      }
      throw error;
    }
  });

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!isNightName(night)) return c.notFound();

    let digest: DigestNight;
    try {
      digest = readNight(config.runsDir, night);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return c.notFound();
      }
      throw error;
    }

    return c.html(
      <Layout title="digest" lane={lane()}>
        <DigestPage night={night} digest={digest} />
      </Layout>,
    );
  });

  return app;
}
