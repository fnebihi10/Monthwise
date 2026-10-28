import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import worker, { handleApi, type Env } from '../worker/index';
import { handleAuth } from '../worker/google-auth';
import { authenticate, hashToken, SESSION_COOKIE } from '../worker/auth';
import { edgeGuard } from '../worker/security';
import type { Snapshot } from '../src/models';

const origin = 'https://monthwise-public.test';
let mf: Miniflare, env: Env;
const people = [
  { id: 'google:alice', email: 'alice@example.test', local: false },
  { id: 'google:bob', email: 'bob@example.test', local: false },
];
const cookies: string[] = [];
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
  for (const file of [
    '0001_ledger.sql',
    '0002_google_sessions.sql',
    '0003_planning.sql',
    '0004_ledger_versions.sql',
    '0005_public_access.sql',
  ])
    for (const sql of readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8')
      .split(/;(?!\s*END\b)/i)
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
  env = {
    DB: db as unknown as D1Database,
    MODE: 'production',
    ACCESS_MODE: 'public',
    APP_ORIGIN: origin,
    GOOGLE_CLIENT_ID: 'client',
    GOOGLE_CLIENT_SECRET: 'test-only',
    EDGE_LIMITER: { limit: async () => ({ success: true }) },
  };
  for (const person of people) {
    const start = await handleAuth(new Request(origin + '/auth/google'), env);
    const target = new URL(start.headers.get('Location')!);
    expect(target.searchParams.has('login_hint')).toBe(false);
    const callback = await handleAuth(
      new Request(
        origin + '/auth/google/callback?code=valid&state=' + target.searchParams.get('state'),
        { headers: { Cookie: start.headers.get('Set-Cookie')!.split(';')[0] } },
      ),
      env,
      { exchange: async () => person },
    );
    expect(callback.status).toBe(303);
    cookies.push(
      callback.headers
        .getSetCookie()
        .find((cookie) => cookie.startsWith(SESSION_COOKIE + '='))!
        .split(';')[0],
    );
  }
});
afterAll(async () => await mf?.dispose());
afterEach(() => vi.restoreAllMocks());
function call(
  person: number,
  path: string,
  method = 'GET',
  data?: unknown,
  requestOrigin = origin,
) {
  return handleApi(
    new Request(origin + '/api/' + path, {
      method,
      headers: {
        Cookie: cookies[person],
        Origin: requestOrigin,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    }),
    env,
  );
}
const ledger = async (person: number) =>
  (await (await call(person, 'ledger?paged=1')).json()) as { snapshot: Snapshot };
const accounts = [crypto.randomUUID(), crypto.randomUUID()];
const entryId = crypto.randomUUID(),
  planId = crypto.randomUUID(),
  goalId = crypto.randomUUID();

it('creates independent public sessions and empty ledgers for two Google accounts', async () => {
  for (const index of [0, 1]) {
    expect(
      await authenticate(
        new Request(origin + '/api/ledger', { headers: { Cookie: cookies[index] } }),
        env,
      ),
    ).toEqual(people[index]);
    expect((await ledger(index)).snapshot.accounts).toHaveLength(0);
    expect(
      (
        await call(index, 'accounts', 'POST', {
          id: accounts[index],
          name: 'Private account',
          kind: 'bank',
          openingBalanceCents: 10000,
        })
      ).status,
    ).toBe(201);
  }
});

it('blocks cross-user ledger, entry, account, transfer, plan, goal, and backup access', async () => {
  const entry = {
    id: entryId,
    accountId: accounts[0],
    kind: 'expense',
    amountCents: 500,
    date: '2026-10-28',
    merchant: 'Alice only',
    category: 'Other',
    note: 'Private',
    revision: 1,
  };
  expect((await call(0, 'entries', 'POST', entry)).status).toBe(201);
  expect(
    (
      await call(0, 'plans', 'POST', {
        id: planId,
        kind: 'bill',
        title: 'Private bill',
        amountCents: 1000,
        dueDate: '2026-11-01',
        category: 'Home',
        recurring: false,
      })
    ).status,
  ).toBe(201);
  expect(
    (await call(0, 'goals', 'POST', { id: goalId, name: 'Private goal', targetCents: 5000 }))
      .status,
  ).toBe(201);
  expect((await ledger(1)).snapshot.entries).toHaveLength(0);
  expect((await ledger(1)).snapshot.plans).toHaveLength(0);
  expect((await ledger(1)).snapshot.goals).toHaveLength(0);
  expect((await call(1, 'entries', 'POST', { ...entry, id: crypto.randomUUID() })).status).toBe(
    404,
  );
  expect((await call(1, 'entries/' + entryId, 'PUT', entry)).status).toBe(404);
  expect((await call(1, 'entries/' + entryId, 'DELETE', { revision: 1 })).status).toBe(409);
  expect((await call(1, 'accounts/' + accounts[0], 'PUT', { name: 'Stolen' })).status).toBe(404);
  expect(
    (
      await call(1, 'transfers', 'POST', {
        id: crypto.randomUUID(),
        sourceAccountId: accounts[1],
        destinationAccountId: accounts[0],
        amountCents: 1,
        date: '2026-10-28',
        note: '',
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await call(1, 'plans/' + planId + '/pay', 'POST', {
        entryId: crypto.randomUUID(),
        accountId: accounts[1],
        date: '2026-10-28',
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await call(1, 'allocations', 'POST', {
        id: crypto.randomUUID(),
        goalId,
        amountCents: 1,
        date: '2026-10-28',
      })
    ).status,
  ).toBe(404);
  const backup = await (await call(0, 'backup')).json();
  expect((await call(1, 'restore', 'POST', { backup })).status).toBe(403);
  expect((await call(1, 'plans/' + planId, 'DELETE', {})).status).toBe(404);
  expect((await call(1, 'goals/' + goalId, 'DELETE', {})).status).toBe(404);
  expect((await ledger(0)).snapshot.entries[0].merchant).toBe('Alice only');
  expect((await call(0, 'entries', 'POST', entry, 'https://attacker.test')).status).toBe(403);
});

it('enforces independent durable read/export/restore limits and advertises retry time', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.now());
  const window = Math.floor(Date.now() / 60000);
  for (const [scope, limit, path, method, body] of [
    ['read', 240, 'ledger/version', 'GET', undefined],
    ['export', 6, 'backup', 'GET', undefined],
    ['restore', 3, 'restore', 'POST', { backup: {} }],
  ] as const) {
    await env.DB.prepare(
      'INSERT INTO api_rate_limits(owner_id,scope,window,count) VALUES(?,?,?,?) ON CONFLICT(owner_id,scope,window) DO UPDATE SET count=excluded.count',
    )
      .bind(people[0].id, scope, window, limit)
      .run();
    const response = await call(0, path, method, body);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    await env.DB.prepare('DELETE FROM api_rate_limits WHERE owner_id=?').bind(people[0].id).run();
  }
  expect((await call(1, 'ledger/version')).status).toBe(200);
});

it('fails closed without the public edge limiter and rejects floods before authentication', async () => {
  const request = new Request(origin + '/api/ledger', {
    headers: { 'CF-Connecting-IP': '192.0.2.1' },
  });
  expect((await edgeGuard(request, { ACCESS_MODE: 'public' }))?.status).toBe(503);
  const response = await worker.fetch(request, {
    ...env,
    EDGE_LIMITER: { limit: async () => ({ success: false }) },
  });
  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('60');
  expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  expect(response.headers.get('Strict-Transport-Security')).toContain('31536000');
  expect(
    (
      await worker.fetch(
        new Request(origin + '/api/ledger', { headers: { 'CF-Connecting-IP': '192.0.2.1' } }),
        env,
      )
    ).status,
  ).toBe(401);
});

it('enforces record quotas inside the database and releases capacity after deletion', async () => {
  // A full counter simulates a large existing ledger without inserting 25,000 fixture records.
  await env.DB.prepare('UPDATE ledger_usage SET record_count=25000 WHERE owner_id=?')
    .bind(people[0].id)
    .run();
  expect(
    (
      await call(0, 'accounts', 'POST', {
        id: crypto.randomUUID(),
        name: 'Over quota',
        kind: 'bank',
        openingBalanceCents: 0,
      })
    ).status,
  ).toBe(409);
  expect((await call(0, 'entries/' + entryId, 'DELETE', { revision: 1 })).status).toBe(200);
  expect(
    (
      await call(0, 'accounts', 'POST', {
        id: crypto.randomUUID(),
        name: 'One free slot',
        kind: 'bank',
        openingBalanceCents: 0,
      })
    ).status,
  ).toBe(201);
  // Restore the real count for subsequent account deletion.
  await env.DB.prepare('UPDATE ledger_usage SET record_count=4 WHERE owner_id=?')
    .bind(people[0].id)
    .run();
});

it('requires a fresh sign-in for deletion and deletes only the authenticated account', async () => {
  expect((await call(0, 'account/delete', 'POST', { confirmation: 'wrong' })).status).toBe(400);
  await env.DB.prepare('UPDATE sessions SET issued_at=0 WHERE user_id=?').bind(people[0].id).run();
  expect((await call(0, 'account/delete', 'POST', { confirmation: 'DELETE' })).status).toBe(403);
  await env.DB.prepare('UPDATE sessions SET issued_at=? WHERE user_id=?')
    .bind(Math.floor(Date.now() / 1000), people[0].id)
    .run();
  const raw = 'b'.repeat(64);
  await env.DB.prepare(
    'INSERT INTO sessions(token_hash,user_id,email,expires_at,issued_at) VALUES(?,?,?,?,?)',
  )
    .bind(
      await hashToken(raw),
      people[0].id,
      people[0].email,
      Math.floor(Date.now() / 1000) + 100,
      Math.floor(Date.now() / 1000),
    )
    .run();
  const response = await call(0, 'account/delete', 'POST', {
    confirmation: 'DELETE',
    ownerId: people[1].id,
  });
  expect(response.status).toBe(200);
  expect(response.headers.getSetCookie().join(';')).toContain('Max-Age=0');
  expect((await call(0, 'ledger/version')).status).toBe(401);
  // Simulate a request that resolved its identity just before deletion completed.
  const stale = await handleApi(
    new Request(origin + '/api/accounts', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        name: 'Stale save',
        kind: 'bank',
        openingBalanceCents: 0,
      }),
    }),
    env,
    async () => people[0],
  );
  expect(stale.status).toBe(401);
  expect(
    await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(people[0].id).first(),
  ).toBeNull();
  expect(
    await authenticate(
      new Request(origin + '/api/ledger', { headers: { Cookie: SESSION_COOKIE + '=' + raw } }),
      env,
    ),
  ).toBeNull();
  expect((await ledger(1)).snapshot.accounts[0].id).toBe(accounts[1]);
  for (const table of [
    'accounts',
    'transactions',
    'plans',
    'goals',
    'ledger_usage',
    'ledger_versions',
  ])
    expect(
      await env.DB.prepare('SELECT count(*) AS count FROM ' + table + ' WHERE owner_id=?')
        .bind(people[0].id)
        .first('count'),
    ).toBe(0);
});
