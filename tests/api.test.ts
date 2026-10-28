import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { handleApi, type Env } from '../worker/index';
import type { Identity } from '../worker/auth';
import type { Snapshot } from '../src/models';
let mf: Miniflare;
let env: Env;
const alice: Identity = { id: 'alice', email: 'alice@example.test', local: false };
const bob: Identity = { id: 'bob', email: 'bob@example.test', local: false };
const account = (name = 'Bank') => ({
  id: crypto.randomUUID(),
  name,
  kind: 'bank',
  openingBalanceCents: 10000,
});
async function call(
  path: string,
  method = 'GET',
  data?: unknown,
  user: Identity | null = alice,
  origin = 'http://localhost',
) {
  // These API tests inject identities instead of running the Google callback.
  if (user)
    await env.DB.prepare('INSERT INTO users(id) VALUES(?) ON CONFLICT(id) DO NOTHING')
      .bind(user.id)
      .run();
  return handleApi(
    new Request('http://localhost/api/' + path, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: data ? JSON.stringify(data) : undefined,
    }),
    env,
    async () => user,
  );
}
async function state(user = alice) {
  return (await (await call('ledger', 'GET', undefined, user)).json()) as Snapshot;
}
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: "export default {fetch(){return new Response('test')}}",
      compatibilityDate: '2026-10-19',
      d1Databases: ['DB'],
    }),
  );
  const db = await mf.getD1Database('DB');
  for (const sql of [
    '0001_ledger.sql',
    '0002_google_sessions.sql',
    '0003_planning.sql',
    '0004_ledger_versions.sql',
    '0005_public_access.sql',
  ]
    .map((name) => readFileSync(new URL('../migrations/' + name, import.meta.url), 'utf8'))
    .join(';')
    .split(/;(?!\s*END\b)/i)
    .map((s) => s.trim())
    .filter(Boolean))
    await db.prepare(sql).run();
  env = { DB: db as unknown as D1Database, MODE: 'production' };
}, 30000);
afterAll(async () => {
  await mf?.dispose();
});
describe('owner-scoped durable ledger on real local D1', () => {
  it('rejects anonymous and cross-origin mutations', async () => {
    expect((await call('ledger', 'GET', undefined, null)).status).toBe(401);
    expect((await call('accounts', 'POST', account(), alice, 'https://evil.test')).status).toBe(
      403,
    );
  });
  it('persists entries, enforces ownership, and detects stale edits', async () => {
    const a = account();
    expect((await call('accounts', 'POST', a)).status).toBe(201);
    const b = account('Other bank');
    expect((await call('accounts', 'POST', b, bob)).status).toBe(201);
    const entry = {
      id: crypto.randomUUID(),
      accountId: a.id,
      kind: 'expense',
      amountCents: 1250,
      date: '2026-10-04',
      merchant: 'Groceries',
      category: 'Groceries',
      note: '',
    };
    expect((await call('entries', 'POST', entry)).status).toBe(201);
    expect((await state()).entries.find((e) => e.id === entry.id)?.amountCents).toBe(1250);
    expect((await state(bob)).entries).toHaveLength(0);
    expect(
      (await call('entries', 'POST', { ...entry, id: crypto.randomUUID(), accountId: b.id }))
        .status,
    ).toBe(404);
    expect((await call('entries/' + entry.id, 'PUT', { ...entry, revision: 1 }, bob)).status).toBe(
      404,
    );
    expect((await call('entries/' + entry.id, 'DELETE', { revision: 1 }, bob)).status).toBe(409);
    expect(
      (await call('entries/' + entry.id, 'PUT', { ...entry, amountCents: 2000, revision: 1 }))
        .status,
    ).toBe(200);
    expect((await call('entries/' + entry.id, 'PUT', { ...entry, revision: 1 })).status).toBe(409);
    expect((await state()).accounts.find((x) => x.id === a.id)?.balanceCents).toBe(8000);
    expect((await call('entries/' + entry.id, 'DELETE', { revision: 2 })).status).toBe(200);
    expect((await state()).accounts.find((x) => x.id === a.id)?.balanceCents).toBe(10000);
  });
  it('moves money atomically without changing income or expense records', async () => {
    const source = account('Cash'),
      destination = account('Savings');
    destination.openingBalanceCents = 0;
    await call('accounts', 'POST', source);
    await call('accounts', 'POST', destination);
    const before = await state();
    const transfer = {
      id: crypto.randomUUID(),
      sourceAccountId: source.id,
      destinationAccountId: destination.id,
      amountCents: 2500,
      date: '2026-10-05',
      note: 'Savings',
    };
    expect((await call('transfers', 'POST', transfer)).status).toBe(201);
    expect((await call('transfers', 'POST', transfer)).status).toBe(409);
    const after = await state();
    expect(after.accounts.find((a) => a.id === source.id)?.balanceCents).toBe(7500);
    expect(after.accounts.find((a) => a.id === destination.id)?.balanceCents).toBe(2500);
    expect(after.entries).toEqual(before.entries);
    expect(after.accounts.reduce((s, a) => s + a.balanceCents, 0)).toBe(
      before.accounts.reduce((s, a) => s + a.balanceCents, 0),
    );
    const foreign = (await state(bob)).accounts[0];
    expect(
      (
        await call('transfers', 'POST', {
          ...transfer,
          id: crypto.randomUUID(),
          destinationAccountId: foreign.id,
        })
      ).status,
    ).toBe(404);
    expect((await state()).accounts).toEqual(after.accounts);
    expect((await call('transfers/' + transfer.id, 'DELETE', {}, bob)).status).toBe(404);
    expect((await call('transfers/' + transfer.id, 'DELETE', {})).status).toBe(200);
    expect((await state()).accounts).toEqual(before.accounts);
  });
  it('validates actual calendar dates and integer cents', async () => {
    const a = (await state()).accounts[0];
    const entry = {
      id: crypto.randomUUID(),
      accountId: a.id,
      kind: 'income',
      amountCents: 100,
      date: '2026-02-30',
      merchant: 'Income',
      category: 'Income',
      note: '',
    };
    expect((await call('entries', 'POST', entry)).status).toBe(400);
    expect(
      (await call('entries', 'POST', { ...entry, date: '2026-02-28', amountCents: 1.1 })).status,
    ).toBe(400);
    expect(
      (
        await call('transfers', 'POST', {
          id: crypto.randomUUID(),
          sourceAccountId: a.id,
          destinationAccountId: a.id,
          amountCents: 100,
          date: '2026-02-28',
          note: '',
        })
      ).status,
    ).toBe(400);
  });
  it('rate-limits writes durably rather than per Worker instance', async () => {
    const user = { id: 'rate-test', email: 'rate@example.test', local: false };
    const window = Math.floor(Date.now() / 60000);
    await env.DB.prepare('INSERT INTO rate_limits(owner_id,window,count) VALUES(?,?,120)')
      .bind(user.id, window)
      .run();
    expect((await call('accounts', 'POST', account(), user)).status).toBe(429);
  });
});

it('corrects a duplicated opening balance without changing October history and rejects stale or foreign edits', async () => {
  const a = { ...account('Correction'), openingBalanceCents: 33500 };
  expect((await call('accounts', 'POST', a)).status).toBe(201);
  for (const [kind, amountCents] of [
    ['income', 33500],
    ['expense', 10500],
  ] as const) {
    expect(
      (
        await call('entries', 'POST', {
          id: crypto.randomUUID(),
          accountId: a.id,
          kind,
          amountCents,
          date: '2026-10-24',
          merchant: 'Correction test',
          category: kind === 'income' ? 'Income' : 'Other',
          note: '',
        })
      ).status,
    ).toBe(201);
  }
  const before = await state();
  expect(before.accounts.find((x) => x.id === a.id)?.balanceCents).toBe(56500);
  const data = {
    name: a.name,
    kind: 'bank',
    openingBalanceCents: 0,
    previous: { name: a.name, kind: a.kind, openingBalanceCents: 33500 },
  };
  expect((await call('accounts/' + a.id, 'PUT', data, bob)).status).toBe(404);
  expect(
    (await call('accounts/' + a.id, 'PUT', { ...data, openingBalanceCents: 0.5 })).status,
  ).toBe(400);
  expect((await call('accounts/' + a.id, 'PUT', data)).status).toBe(200);
  expect((await call('accounts/' + a.id, 'PUT', data)).status).toBe(409);
  const after = await state();
  expect(after.accounts.find((x) => x.id === a.id)?.balanceCents).toBe(23000);
  expect(after.entries.filter((x) => x.accountId === a.id)).toEqual(
    before.entries.filter((x) => x.accountId === a.id),
  );
});
