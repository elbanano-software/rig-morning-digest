import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('links both nights on disk to their digests and shows status counts', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const app = createApp(config);
    const res = await app.request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('ok 10 · retry 4 · fail 1');
    expect(html).toContain('ok 7 · retry 0 · fail 0');

    const nightResponses = await Promise.all([
      app.request('/digest/2026-10-28'),
      app.request('/digest/2026-10-27'),
    ]);
    expect(nightResponses.map(({ status }) => status)).toEqual([200, 200]);
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
