import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/types.js';

describe('readNight', () => {
  it('aggregates the 2026-10-28 run log and counts its malformed line', () => {
    const night = readNight('runs', '2026-10-28');

    expect(night.badLines).toBe(1);
    expect(night.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(night.rows).toHaveLength(5);
    expect(night.rows.map(({ job }) => job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('keeps retry history, the latest status, and the last reported error', () => {
    const { rows } = readNight('runs', '2026-10-28');
    const refresh = rows.find(({ job }) => job === 'fixtures/refresh');
    const sync = rows.find(({ job }) => job === 'lane/sync');

    expect(refresh).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(sync).toMatchObject({
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'lock held',
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });

  it('retains jobs whose owner is null and records the latest failure', () => {
    const { rows } = readNight('runs', '2026-10-28');

    expect(rows.find(({ job }) => job === 'digest/render')).toMatchObject({
      owner: null,
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
    });
    expect(rows.find(({ job }) => job === 'notes/backup')).toMatchObject({
      owner: 'lane-07',
      runs: 1,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
  });
});
