import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/types.js';

describe('digest JSON route', () => {
  it('returns the shared reader result, including sorted rows and malformed line count', async () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-api-'));
    const log = [
      JSON.stringify({ at: '2026-10-28T23:00:00+01:00', job: 'zeta', status: 'ok', owner: 'rook' }),
      JSON.stringify({ at: '2026-10-28T23:01:00+01:00', job: 'alpha', status: 'retry', owner: null }),
      '{not json',
    ].join('\n');
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), log);

    try {
      const response = await createApp({
        adapter: 'shim',
        installed: '2026-10-29T14:06:00+01:00',
        beatEverySeconds: 60,
        runsDir,
      }).request('/api/digest/2026-10-28');

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      const { rows, badLines } = readNight(runsDir, '2026-10-28');
      expect(await response.json()).toEqual({ rows, badLines });
      expect(rows.map(({ job }) => job)).toEqual(['alpha', 'zeta']);
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });

  it('returns a JSON 404 when the night file is missing', async () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-api-'));

    try {
      const response = await createApp({
        adapter: 'shim',
        installed: '2026-10-29T14:06:00+01:00',
        beatEverySeconds: 60,
        runsDir,
      }).request('/api/digest/2026-10-28');

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Night not found' });
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });

  it('returns an empty result for an empty night file', async () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-api-'));
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');

    try {
      const response = await createApp({
        adapter: 'shim',
        installed: '2026-10-29T14:06:00+01:00',
        beatEverySeconds: 60,
        runsDir,
      }).request('/api/digest/2026-10-28');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ rows: [], badLines: 0 });
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });
});
