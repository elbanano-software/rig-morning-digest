import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight, type DigestNight } from './digest/types.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    let digest: DigestNight;
    try {
      digest = readNight(config.runsDir, c.req.param('night'));
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
        <DigestPage night={c.req.param('night')} digest={digest} />
      </Layout>,
    );
  });

  return app;
}
