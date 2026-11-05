import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: 'ok' | 'retry' | 'fail';
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type DigestNight = {
  rows: DigestRow[];
  badLines: number;
};

type RunEvent = {
  at: string;
  job: string;
  status: DigestRow['lastStatus'];
  owner: string | null;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRunEvent(value: unknown): value is RunEvent {
  if (!isRecord(value)) return false;

  return (
    typeof value.at === 'string' &&
    typeof value.job === 'string' &&
    (value.status === 'ok' || value.status === 'retry' || value.status === 'fail') &&
    'owner' in value &&
    (typeof value.owner === 'string' || value.owner === null) &&
    (value.error === undefined || typeof value.error === 'string')
  );
}

/** Read and aggregate the JSONL run log for one night. */
export function readNight(runsDir: string, night: string): DigestNight {
  const contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const lines = contents.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();

  const jobs = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of lines) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      badLines += 1;
      continue;
    }

    if (!isRunEvent(value)) {
      badLines += 1;
      continue;
    }

    const row = jobs.get(value.job);
    if (row === undefined) {
      jobs.set(value.job, {
        job: value.job,
        owner: value.owner,
        runs: 1,
        retries: value.status === 'retry' ? 1 : 0,
        lastStatus: value.status,
        lastError: value.error ?? null,
        firstAt: value.at,
        lastAt: value.at,
      });
      continue;
    }

    row.owner = value.owner;
    row.runs += 1;
    if (value.status === 'retry') row.retries += 1;
    row.lastStatus = value.status;
    if (value.error !== undefined) row.lastError = value.error;
    row.lastAt = value.at;
  }

  return {
    rows: [...jobs.values()].sort((left, right) => left.job.localeCompare(right.job)),
    badLines,
  };
}
