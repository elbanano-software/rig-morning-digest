import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const directories: string[] = [];

function createRunsDir() {
  const directory = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  directories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('digest page', () => {
  it('renders sorted rows in the shared layout and marks failures and three or more retries', async () => {
    const runsDir = createRunsDir();
    writeFileSync(
      join(runsDir, '2026-10-28.jsonl'),
      [
        JSON.stringify({ at: '2026-10-28T23:00:00+01:00', job: 'z-job', status: 'retry', owner: null }),
        JSON.stringify({ at: '2026-10-28T23:01:00+01:00', job: 'z-job', status: 'retry', owner: null }),
        JSON.stringify({ at: '2026-10-28T23:02:00+01:00', job: 'z-job', status: 'retry', owner: null }),
        JSON.stringify({ at: '2026-10-28T23:03:00+01:00', job: 'a-job', status: 'fail', owner: 'rook' }),
      ].join('\n'),
    );

    const response = await createApp({
      adapter: 'shim',
      installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60,
      runsDir,
    }).request('/digest/2026-10-28');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<title>rig · digest</title>');
    expect(html).toContain('no marker set');
    expect(html.indexOf('a-job')).toBeLessThan(html.indexOf('z-job'));
    expect(html).toContain('<span class="warn">fail</span>');
    expect(html).toContain('<span class="warn">3</span>');
    expect(html).toContain('—');
    expect(html).not.toContain('<script');
  });

  it('renders an empty run log as nothing ran', async () => {
    const runsDir = createRunsDir();
    writeFileSync(join(runsDir, '2026-10-29.jsonl'), '');

    const response = await createApp({
      adapter: 'shim',
      installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60,
      runsDir,
    }).request('/digest/2026-10-29');

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('nothing ran');
  });

  it('returns 404 when the run log does not exist', async () => {
    const runsDir = createRunsDir();

    const response = await createApp({
      adapter: 'shim',
      installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60,
      runsDir,
    }).request('/digest/missing-night');

    expect(response.status).toBe(404);
  });
});
