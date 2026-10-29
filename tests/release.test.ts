import { beforeAll, afterAll, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import { handleApi, type Env } from '../worker/index';
import { validateBackup, type Backup } from '../src/backup';
import { planningTotals } from '../src/planning';
import type { Snapshot } from '../src/models';
import type { LedgerPage } from '../src/models';
import { serializeBackup } from '../src/backup';
let mf: Miniflare, env: Env;
const user = { id: 'release-owner', email: 'owner@test', local: false },
  other = { id: 'other-owner', email: 'other@test', local: false };
const accountId = crypto.randomUUID(),
  goalId = crypto.randomUUID(),
  billId = crypto.randomUUID();
async function call(path: string, method = 'GET', data?: unknown, identity = user) {
  // Simulate the user row normally created by the verified Google callback.
  await env.DB.prepare('INSERT INTO users(id) VALUES(?) ON CONFLICT(id) DO NOTHING')
    .bind(identity.id)
    .run();
  return handleApi(
    new Request('http://localhost/api/' + path, {
      method,
      headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    }),
    env,
    async () => identity,
  );
}
const ledger = async (identity = user) =>
  (await (await call('ledger', 'GET', undefined, identity)).json()) as Snapshot;
const payload = async () => (await (await call('backup')).json()) as Backup;
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
  env = { DB: db as unknown as D1Database, MODE: 'production' };
  for (const name of [
    '0001_ledger.sql',
    '0002_google_sessions.sql',
    '0003_planning.sql',
    '0004_ledger_versions.sql',
    '0005_public_access.sql',
  ])
    for (const sql of readFileSync(new URL('../migrations/' + name, import.meta.url), 'utf8')
      .split(/;(?!\s*END\b)/i)
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
  expect(
    (
      await call('accounts', 'POST', {
        id: accountId,
        name: 'Bank',
        kind: 'bank',
        openingBalanceCents: 100000,
      })
    ).status,
  ).toBe(201);
}, 30000);
afterAll(async () => await mf?.dispose());
it('keeps planned income and bills out of actual totals until paid, including repeated payment', async () => {
  expect(
    (
      await call('plans', 'POST', {
        id: billId,
        kind: 'bill',
        title: 'Rent',
        amountCents: 10000,
        dueDate: '2026-10-31',
        category: 'Home',
        recurring: true,
      })
    ).status,
  ).toBe(201);
  const incomeId = crypto.randomUUID();
  await call('plans', 'POST', {
    id: incomeId,
    kind: 'income',
    title: 'Salary',
    amountCents: 90000,
    dueDate: '2026-10-01',
    category: 'Income',
    recurring: true,
  });
  const before = planningTotals(await ledger(), '2026-10');
  expect(before.income).toBe(0);
  expect(before.spent).toBe(0);
  expect(before.bills).toBe(10000);
  expect(before.expected).toBe(90000);
  const payment = { entryId: crypto.randomUUID(), accountId, date: '2026-10-23' };
  expect((await call('plans/' + billId + '/pay', 'POST', payment)).status).toBe(200);
  expect(
    (await call('plans/' + billId + '/pay', 'POST', { ...payment, entryId: crypto.randomUUID() }))
      .status,
  ).toBe(200);
  const after = await ledger();
  expect(after.entries).toHaveLength(1);
  expect(after.accounts[0].balanceCents).toBe(90000);
  expect(planningTotals(after, '2026-10').bills).toBe(0);
  expect((await call('plans/' + billId + '/pay', 'POST', payment, other)).status).toBe(404);
});
it('copies recurring plans and budgets without carrying payment state or overwriting past months', async () => {
  await call('budgets', 'POST', {
    id: crypto.randomUUID(),
    month: '2026-10',
    category: 'Groceries',
    amountCents: 20000,
  });
  await call('copy-month', 'POST', { source: '2026-10', destination: '2027-02' });
  await call('copy-month', 'POST', { source: '2026-10', destination: '2027-02' });
  const state = await ledger();
  expect(state.budgets.filter((b) => b.month === '2027-02')).toHaveLength(1);
  expect(
    state.plans.find((p) => p.title === 'Rent' && p.dueDate === '2027-02-28')?.paidEntryId,
  ).toBeNull();
  expect(state.plans.find((p) => p.id === billId)?.paidEntryId).toBeTruthy();
  await call('budgets', 'POST', {
    id: crypto.randomUUID(),
    month: '2027-02',
    category: 'Groceries',
    amountCents: 30000,
  });
  expect((await ledger()).budgets.find((b) => b.month === '2026-10')?.amountCents).toBe(20000);
});
it('reserves goals without recording expenses or subtracting category budgets twice', async () => {
  await call('goals', 'POST', { id: goalId, name: 'Trip', targetCents: 50000 });
  await call('allocations', 'POST', {
    id: crypto.randomUUID(),
    goalId,
    amountCents: 5000,
    date: '2026-10-23',
  });
  const state = await ledger(),
    total = planningTotals(state, '2026-10');
  expect(total.spent).toBe(10000);
  expect(total.reserved).toBe(5000);
  expect(total.unassigned).toBe(85000);
  expect(
    (
      await call(
        'allocations',
        'POST',
        { id: crypto.randomUUID(), goalId, amountCents: 100, date: '2026-10-23' },
        other,
      )
    ).status,
  ).toBe(404);
});
it('round-trips full backups and restores missing records atomically without erasing new records', async () => {
  const before = validateBackup(await payload());
  const id = crypto.randomUUID();
  await call('entries', 'POST', {
    id,
    accountId,
    kind: 'expense',
    amountCents: 1250,
    date: '2026-10-24',
    merchant: 'Later purchase',
    category: 'Shopping',
    note: '',
  });
  expect((await call('restore', 'POST', { backup: before })).status).toBe(200);
  expect((await ledger()).entries.some((e) => e.id === id)).toBe(true);
  await env.DB.batch(
    ['allocations', 'goals', 'plans', 'budgets', 'transfers', 'transactions', 'accounts'].map(
      (table) => env.DB.prepare('DELETE FROM ' + table + ' WHERE owner_id=?').bind(user.id),
    ),
  );
  expect((await call('restore', 'POST', { backup: before })).status).toBe(200);
  const after = validateBackup(await payload());
  for (const field of [
    'accounts',
    'entries',
    'transfers',
    'budgets',
    'plans',
    'goals',
    'allocations',
  ] as const) {
    const normalize = (rows: unknown[]) =>
      JSON.stringify(
        [...rows].sort((a, b) => (a as { id: string }).id.localeCompare((b as { id: string }).id)),
      );
    expect(normalize(after[field])).toBe(normalize(before[field]));
  }
  expect((await ledger()).accounts[0].balanceCents).toBe(90000);
  expect((await call('restore', 'POST', { backup: before }, other)).status).toBe(403);
});
it('rejects invalid and conflicting backup records without partial writes', async () => {
  const backup = await payload();
  expect(
    (
      await call('restore', 'POST', {
        backup: { ...backup, entries: [{ ...backup.entries[0], accountId: crypto.randomUUID() }] },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await call('restore', 'POST', {
        backup: { ...backup, goals: [{ ...backup.goals[0], targetCents: 100 }] },
      })
    ).status,
  ).toBe(409);
  expect((await ledger()).goals.find((g) => g.id === goalId)?.targetCents).toBe(50000);
});
it('accepts a duplicate offline create only when the complete payload matches', async () => {
  const entry = {
    id: crypto.randomUUID(),
    accountId,
    kind: 'expense',
    amountCents: 500,
    date: '2026-10-23',
    merchant: 'Offline',
    category: 'Other',
    note: '',
  };
  expect((await call('entries', 'POST', entry)).status).toBe(201);
  expect((await call('entries', 'POST', entry)).status).toBe(200);
  expect((await call('entries', 'POST', { ...entry, amountCents: 600 })).status).toBe(409);
  expect((await ledger()).entries.filter((e) => e.id === entry.id)).toHaveLength(1);
});

it('restores a large exported backup atomically and pages every entry and transfer without duplicates', async () => {
  const owner = { id: 'large-ledger-owner', email: 'large@test', local: false };
  const source = crypto.randomUUID(),
    destination = crypto.randomUUID();
  const large: Snapshot = {
    user: owner,
    accounts: [source, destination].map((id) => ({
      id,
      name: id,
      kind: 'bank',
      openingBalanceCents: 0,
      balanceCents: 0,
    })),
    entries: Array.from({ length: 5101 }, () => ({
      id: crypto.randomUUID(),
      accountId: source,
      kind: 'expense',
      amountCents: 1,
      date: '2026-10-28',
      merchant: 'Large backup',
      category: 'Other',
      note: 'x'.repeat(250),
      revision: 1,
    })),
    transfers: Array.from({ length: 501 }, () => ({
      id: crypto.randomUUID(),
      sourceAccountId: source,
      destinationAccountId: destination,
      amountCents: 1,
      date: '2026-10-28',
      note: '',
    })),
    budgets: [],
    plans: [],
    goals: [],
    allocations: [],
  };
  const serialized = serializeBackup(large);
  expect(new TextEncoder().encode(serialized).length).toBeGreaterThan(2_000_000);
  const before = await (await call('ledger/version', 'GET', undefined, user)).json();
  const conflict = JSON.parse(serialized) as Backup;
  conflict.entries[conflict.entries.length - 1].id = (await payload()).entries[0].id;
  expect((await call('restore', 'POST', { backup: conflict }, owner)).status).toBe(409);
  const rolledBack = await ledger(owner);
  expect(rolledBack.accounts).toHaveLength(0);
  expect(rolledBack.entries).toHaveLength(0);
  expect(
    ((await (await call('ledger/version', 'GET', undefined, owner)).json()) as { version: number })
      .version,
  ).toBe(0);
  expect((await call('restore', 'POST', { backup: JSON.parse(serialized) }, owner)).status).toBe(
    200,
  );
  expect(await (await call('ledger/version', 'GET', undefined, user)).json()).toEqual(before);
  const version = (await (await call('ledger/version', 'GET', undefined, owner)).json()) as {
    version: number;
  };
  expect(version.version).toBe(5604);
  const ids: string[] = [],
    transferIds: string[] = [];
  let path = 'ledger?paged=1';
  do {
    const response = await call(path, 'GET', undefined, owner);
    expect(response.status).toBe(200);
    const page = (await response.json()) as LedgerPage;
    expect(page.version).toBe(version.version);
    expect(page.snapshot.entries.length).toBeLessThanOrEqual(500);
    expect(page.snapshot.transfers.length).toBeLessThanOrEqual(500);
    ids.push(...page.snapshot.entries.map((e) => e.id));
    transferIds.push(...page.snapshot.transfers.map((t) => t.id));
    if (!page.next.entries && !page.next.transfers) break;
    path =
      'ledger?' +
      new URLSearchParams({
        paged: '1',
        entriesAfter: page.next.entries || 'done',
        transfersAfter: page.next.transfers || 'done',
      });
  } while (true);
  expect(ids.sort()).toEqual(large.entries.map((e) => e.id).sort());
  expect(transferIds.sort()).toEqual(large.transfers.map((t) => t.id).sort());
  const restored = await ledger(owner);
  expect(restored.accounts.find((a) => a.id === source)?.balanceCents).toBe(-5602);
  expect(restored.accounts.find((a) => a.id === destination)?.balanceCents).toBe(501);
  expect((await call('ledger?paged=1&entriesAfter=invalid', 'GET', undefined, owner)).status).toBe(
    400,
  );
  expect((await call('ledger/version', 'GET', undefined, other)).status).toBe(200);
  expect(
    ((await (await call('ledger?paged=1', 'GET', undefined, other)).json()) as LedgerPage).snapshot
      .entries,
  ).toHaveLength(0);
}, 30000);

it('changes the ledger revision for edits and deletes, but not identical retried creates', async () => {
  const entry = {
    id: crypto.randomUUID(),
    accountId,
    kind: 'expense',
    amountCents: 1,
    date: '2026-10-28',
    merchant: 'Revision check',
    category: 'Other',
    note: '',
  };
  const revision = async () =>
    ((await (await call('ledger/version')).json()) as { version: number }).version;
  const before = await revision();
  await call('entries', 'POST', entry);
  expect(await revision()).toBe(before + 1);
  await call('entries', 'POST', entry);
  expect(await revision()).toBe(before + 1);
  await call('entries/' + entry.id, 'PUT', { ...entry, amountCents: 2, revision: 1 });
  expect(await revision()).toBe(before + 2);
  await call('entries/' + entry.id, 'DELETE', { revision: 2 });
  expect(await revision()).toBe(before + 3);
});

it('restores escaped text without exceeding the database string parameter limit', async () => {
  const identity = { id: 'escaped-backup-owner', email: 'escaped@example.test', local: false };
  const id = crypto.randomUUID();
  const backup: Backup = {
    format: 'monthwise',
    version: 1,
    ownerId: identity.id,
    createdAt: new Date().toISOString(),
    accounts: [{ id, name: 'Bank', kind: 'bank', openingBalanceCents: 0, balanceCents: 0 }],
    entries: Array.from({ length: 1000 }, () => ({
      id: crypto.randomUUID(),
      accountId: id,
      kind: 'expense',
      amountCents: 1,
      date: '2026-10-28',
      merchant: 'Shop' + '\0'.repeat(90),
      category: 'Other',
      note: '\0'.repeat(250),
      revision: 1,
    })),
    transfers: [],
    budgets: [],
    plans: [],
    goals: [],
    allocations: [],
  };
  expect(new TextEncoder().encode(JSON.stringify(backup.entries)).byteLength).toBeGreaterThan(
    2_000_000,
  );
  expect((await call('restore', 'POST', { backup }, identity)).status).toBe(200);
  const restored = await ledger(identity);
  expect(restored.entries).toHaveLength(1000);
  expect(restored.entries[0].note).toBe('\0'.repeat(250));
});
