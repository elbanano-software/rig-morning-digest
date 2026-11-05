import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const events = [
  JSON.stringify({
    at: '2026-11-04T23:00:00+01:00',
    job: 'digest/render',
    status: 'retry',
    owner: 'rook',
    error: 'upstream 503',
  }),
  JSON.stringify({
    at: '2026-11-04T23:05:00+01:00',
    job: 'digest/render',
    status: 'fail',
    owner: 'rook',
    error: 'timeout',
  }),
  JSON.stringify({
    at: '2026-11-04T23:10:00+01:00',
    job: 'lane/sync',
    status: 'ok',
    owner: null,
  }),
].join('\n');
const malformedEvents = `${events}\n{malformed line`;

describe('digest routes', () => {
  let runsDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
    app = createApp({
      adapter: 'shim',
      installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60,
      runsDir,
    });
  });

  afterEach(() => {
    rmSync(runsDir, { recursive: true, force: true });
  });

  it('serves the populated digest as both a page and JSON', async () => {
    writeFileSync(join(runsDir, '2026-11-04.jsonl'), events);

    const [page, json] = await Promise.all([
      app.request('/digest/2026-11-04'),
      app.request('/api/digest/2026-11-04'),
    ]);

    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('digest/render');
    expect(html).toContain('lane/sync');
    expect(html).toContain('timeout');

    expect(json.status).toBe(200);
    expect(await json.json()).toEqual({
      rows: [
        {
          job: 'digest/render',
          owner: 'rook',
          runs: 2,
          retries: 1,
          lastStatus: 'fail',
          lastError: 'timeout',
          firstAt: '2026-11-04T23:00:00+01:00',
          lastAt: '2026-11-04T23:05:00+01:00',
        },
        {
          job: 'lane/sync',
          owner: null,
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-11-04T23:10:00+01:00',
          lastAt: '2026-11-04T23:10:00+01:00',
        },
      ],
      badLines: 0,
    });
  });

  it('returns 404 from both routes when the night is missing', async () => {
    const [page, json] = await Promise.all([
      app.request('/digest/2026-11-04'),
      app.request('/api/digest/2026-11-04'),
    ]);

    expect(page.status).toBe(404);
    expect(json.status).toBe(404);
  });

  it('renders an empty night and returns empty rows as JSON', async () => {
    writeFileSync(join(runsDir, '2026-11-04.jsonl'), '');

    const [page, json] = await Promise.all([
      app.request('/digest/2026-11-04'),
      app.request('/api/digest/2026-11-04'),
    ]);

    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(json.status).toBe(200);
    expect(await json.json()).toEqual({ rows: [], badLines: 0 });
  });

  it('counts a malformed line without failing either route', async () => {
    writeFileSync(join(runsDir, '2026-11-04.jsonl'), malformedEvents);

    const [page, json] = await Promise.all([
      app.request('/digest/2026-11-04'),
      app.request('/api/digest/2026-11-04'),
    ]);

    expect(page.status).toBe(200);
    expect((await page.text())).toContain('digest/render');
    expect(json.status).toBe(200);
    expect(await json.json()).toMatchObject({
      badLines: 1,
      rows: [{ job: 'digest/render' }, { job: 'lane/sync' }],
    });
  });
});
