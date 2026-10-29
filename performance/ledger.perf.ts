import { beforeAll, afterAll, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { handleApi, type Env } from '../worker/index';
import { buildReports, reportForYear } from '../src/reports';
import { validateBackup, type Backup } from '../src/backup';
import type { LedgerPage } from '../src/models';

let mf: Miniflare, env: Env;
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: "export default {fetch(){return new Response('ok')}}",
      compatibilityDate: '2026-10-19',
      d1Databases: ['DB'],
    }),
  );
  const db = await mf.getD1Database('DB');
  for (const file of readdirSync('migrations')
    .filter((file) => file.endsWith('.sql'))
    .sort())
    for (const sql of readFileSync('migrations/' + file, 'utf8')
      .split(/;(?!\s*END\b)/i)
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
  env = { DB: db as unknown as D1Database, MODE: 'local' };
});
afterAll(async () => await mf?.dispose());
const call = (path: string, method = 'GET', data?: unknown) =>
  handleApi(
    new Request('http://localhost/api/' + path, {
      method,
      headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    }),
    env,
  );

it('restores, pages, reports and concurrently reads a synthetic ledger at the 25,000-record capacity', async () => {
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  const backup: Backup = {
    format: 'monthwise',
    version: 1,
    createdAt: new Date().toISOString(),
    ownerId: 'local-development-user',
    accounts: ids.map((id) => ({
      id,
      name: 'Synthetic account',
      kind: 'bank',
      openingBalanceCents: 0,
      balanceCents: 0,
    })),
    entries: Array.from({ length: 24498 }, (_, i) => ({
      id: crypto.randomUUID(),
      accountId: ids[0],
      kind: i % 2 ? 'expense' : 'income',
      amountCents: 100,
      date: `${2023 + (i % 4)}-${String((i % 12) + 1).padStart(2, '0')}-15`,
      merchant: 'Synthetic ' + i,
      category: i % 2 ? 'Other' : 'Income',
      note: '',
      revision: 1,
    })),
    transfers: Array.from({ length: 500 }, () => ({
      id: crypto.randomUUID(),
      sourceAccountId: ids[0],
      destinationAccountId: ids[1],
      amountCents: 100,
      date: '2026-10-15',
      note: '',
    })),
    plans: [],
    budgets: [],
    goals: [],
    allocations: [],
  };
  const start = performance.now();
  expect((await call('restore', 'POST', { backup })).status).toBe(200);
  const restoredAt = performance.now();
  let path = 'ledger?paged=1',
    pages = 0;
  const entries: Backup['entries'] = [],
    transfers: Backup['transfers'] = [];
  let version: number | undefined;
  do {
    const response = await call(path);
    expect(response.status).toBe(200);
    const page = (await response.json()) as LedgerPage;
    version ??= page.version;
    expect(page.version).toBe(version);
    entries.push(...page.snapshot.entries);
    transfers.push(...page.snapshot.transfers);
    pages++;
    if (!page.next.entries && !page.next.transfers) break;
    path =
      'ledger?' +
      new URLSearchParams({
        paged: '1',
        entriesAfter: page.next.entries || 'done',
        transfersAfter: page.next.transfers || 'done',
      });
  } while (true);
  const pagedAt = performance.now();
  expect(new Set(entries.map((e) => e.id)).size).toBe(24498);
  expect(new Set(transfers.map((t) => t.id)).size).toBe(500);
  const reports = buildReports(entries);
  const totals = [2023, 2024, 2025, 2026].map((year) => reportForYear(reports, year));
  expect(totals.reduce((n, t) => n + t.income - t.spent, 0)).toBe(0);
  expect(validateBackup({ ...backup, entries, transfers }).entries.length).toBe(24498);
  const reportedAt = performance.now();
  const responses = await Promise.all(Array.from({ length: 20 }, () => call('ledger/version')));
  expect(responses.every((response) => response.status === 200)).toBe(true);
  const metrics = {
    synthetic: true,
    totalRecords: 25000,
    pages,
    restoreMs: Math.round(restoredAt - start),
    paginationMs: Math.round(pagedAt - restoredAt),
    reportsAndValidationMs: Math.round(reportedAt - pagedAt),
    concurrent20VersionReadsMs: Math.round(performance.now() - reportedAt),
  };
  mkdirSync('.wrangler/performance', { recursive: true });
  writeFileSync('.wrangler/performance/latest.json', JSON.stringify(metrics, null, 2) + '\n');
  console.info(JSON.stringify(metrics));
  // Broad local regression budgets, not production latency promises.
  expect(metrics.restoreMs).toBeLessThan(30000);
  expect(metrics.paginationMs).toBeLessThan(30000);
  expect(metrics.reportsAndValidationMs).toBeLessThan(3000);
});
