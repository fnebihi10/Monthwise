import { ApiError, json, text, amount, date, uuid, body, accountExists } from './common';
import { planningQueries, featureRoute, makeBackup } from './features';
import type { Snapshot } from '../src/models';
import { authenticate, type AuthEnv, type Identity } from './auth';
import { handleAuth } from './google-auth';
import { expenseCategories } from '../src/models';
import type { LedgerPage } from '../src/models';
import { secureResponse, edgeGuard, userRate, limited } from './security';
import { deleteAccount } from './account';
import { failureResponse } from './diagnostics';
import { health } from './health';
export type Env = AuthEnv & { DB: D1Database; ASSETS?: Fetcher };
export async function snapshot(db: D1Database, user: Identity): Promise<Snapshot> {
  return (await readSnapshot(db, user)).snapshot;
}
const PAGE_SIZE = 500;
async function readSnapshot(
  db: D1Database,
  user: Identity,
  cursors?: { entries: string; transfers: string },
): Promise<LedgerPage> {
  const firstPage = !cursors || (!cursors.entries && !cursors.transfers);
  const pageQuery = (query: string, cursor: string | undefined) =>
    cursor === undefined
      ? db.prepare(query + ' ORDER BY date DESC,id').bind(user.id)
      : db
          .prepare(query + ' AND id>? ORDER BY id LIMIT ?')
          .bind(user.id, cursor, cursor === 'done' ? 0 : PAGE_SIZE + 1);
  const results = await db.batch<Record<string, unknown>>([
    firstPage
      ? db
          .prepare(
            `SELECT a.id,a.name,a.kind,a.opening_balance_cents AS openingBalanceCents,
 a.opening_balance_cents
 + COALESCE((SELECT SUM(CASE WHEN t.kind='income' THEN t.amount_cents ELSE -t.amount_cents END) FROM transactions t WHERE t.owner_id=a.owner_id AND t.account_id=a.id),0)
 + COALESCE((SELECT SUM(x.amount_cents) FROM transfers x WHERE x.owner_id=a.owner_id AND x.destination_account_id=a.id),0)
 - COALESCE((SELECT SUM(x.amount_cents) FROM transfers x WHERE x.owner_id=a.owner_id AND x.source_account_id=a.id),0) AS balanceCents
 FROM accounts a WHERE a.owner_id=? ORDER BY a.rowid`,
          )
          .bind(user.id)
      : db.prepare('SELECT 1 WHERE 0'),
    pageQuery(
      'SELECT id,account_id AS accountId,kind,amount_cents AS amountCents,date,merchant,category,note,revision FROM transactions WHERE owner_id=?',
      cursors?.entries,
    ),
    pageQuery(
      'SELECT id,source_account_id AS sourceAccountId,destination_account_id AS destinationAccountId,amount_cents AS amountCents,date,note FROM transfers WHERE owner_id=?',
      cursors?.transfers,
    ),
    ...planningQueries(db, user.id).map((query) =>
      firstPage ? query : db.prepare('SELECT 1 WHERE 0'),
    ),
    db.prepare('SELECT version FROM ledger_versions WHERE owner_id=?').bind(user.id),
  ]);
  const entries = results[1].results,
    transfers = results[2].results;
  const next = {
    entries: cursors && entries.length > PAGE_SIZE ? String(entries[PAGE_SIZE - 1].id) : null,
    transfers: cursors && transfers.length > PAGE_SIZE ? String(transfers[PAGE_SIZE - 1].id) : null,
  };
  return {
    next,
    version: Number(results[7].results[0]?.version ?? 0),
    snapshot: {
      user,
      accounts: results[0].results,
      entries: cursors ? entries.slice(0, PAGE_SIZE) : entries,
      transfers: cursors ? transfers.slice(0, PAGE_SIZE) : transfers,
      budgets: results[3].results,
      plans: results[4].results.map((row) => ({
        ...(row as Record<string, unknown>),
        recurring: (row as Record<string, unknown>).recurring === 1,
      })),
      goals: results[5].results,
      allocations: results[6].results,
    } as unknown as Snapshot,
  };
}
export async function handleApi(
  request: Request,
  env: Env,
  resolveIdentity: (request: Request, env: AuthEnv) => Promise<Identity | null> = authenticate,
  requestId = crypto.randomUUID(),
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const user = await resolveIdentity(request, env);
    if (!user) return json({ error: 'Sign in to open your ledger.' }, 401);
    if (
      !user.local &&
      !(await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(user.id).first())
    )
      return json({ error: 'Sign in again to open your ledger.' }, 401);
    if (request.method === 'GET') {
      await userRate(env.DB, user.id, 'read', 240);
      if (
        env.ACCESS_MODE === 'public' &&
        (url.pathname === '/api/backup' ||
          (url.pathname === '/api/ledger' && url.searchParams.get('paged') !== '1'))
      )
        await userRate(env.DB, user.id, 'export', 6);
    }
    if (request.method === 'GET' && url.pathname === '/api/ledger/version') {
      const row = await env.DB.prepare('SELECT version FROM ledger_versions WHERE owner_id=?')
        .bind(user.id)
        .first<{ version: number }>();
      return json({ ownerId: user.id, version: row?.version ?? 0 });
    }
    if (request.method === 'GET' && url.pathname === '/api/backup')
      return json(makeBackup(await snapshot(env.DB, user)));
    if (request.method === 'GET' && url.pathname === '/api/ledger') {
      if (url.searchParams.get('paged') === '1') {
        const cursor = (name: string) => {
          const value = url.searchParams.get(name) || '';
          if (value && value !== 'done') uuid(value);
          return value;
        };
        return json(
          await readSnapshot(env.DB, user, {
            entries: cursor('entriesAfter'),
            transfers: cursor('transfersAfter'),
          }),
        );
      }
      return json(await snapshot(env.DB, user));
    }
    if (!['POST', 'PUT', 'DELETE'].includes(request.method))
      throw new ApiError(405, 'Method not allowed.');
    // Same-origin JSON requests only. Identity always comes from the verified session, never the body.
    if (
      request.headers.get('origin') !== url.origin ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      throw new ApiError(403, 'Request must come from this app.');
    const window = Math.floor(Date.now() / 60000);
    const rate = await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO rate_limits(owner_id,window,count) VALUES(?,?,1) ON CONFLICT(owner_id,window) DO UPDATE SET count=count+1 RETURNING count',
      ).bind(user.id, window),
      env.DB.prepare('DELETE FROM rate_limits WHERE window<?').bind(window - 2),
    ]);
    if (Number((rate[0].results[0] as { count: number }).count) > 120)
      return new Response(JSON.stringify({ error: 'Too many changes. Try again in a minute.' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Retry-After': '60',
        },
      });
    // Hosted users are created only by a fresh Google callback, never by a stale save/restore.
    if (user.local)
      await env.DB.prepare('INSERT INTO users(id) VALUES(?) ON CONFLICT(id) DO NOTHING')
        .bind(user.id)
        .run();
    const data = await body(request);
    const path = url.pathname;
    if (path === '/api/restore' && env.ACCESS_MODE === 'public')
      await userRate(env.DB, user.id, 'restore', 3);
    if (path === '/api/account/delete' && request.method === 'POST')
      return await deleteAccount(request, env.DB, user, data.confirmation);
    const feature = await featureRoute(path, request.method, data, env.DB, user, () =>
      snapshot(env.DB, user),
    );
    if (feature) return feature;
    if (path === '/api/accounts' && request.method === 'POST') {
      const id = uuid(data.id),
        name = text(data.name, 'account name', 60),
        kind = data.kind;
      if (!['cash', 'bank', 'savings'].includes(String(kind)))
        throw new ApiError(400, 'Choose an account type.');
      await env.DB.prepare(
        'INSERT INTO accounts(id,owner_id,name,kind,opening_balance_cents) VALUES(?,?,?,?,?)',
      )
        .bind(id, user.id, name, kind, amount(data.openingBalanceCents, true))
        .run();
      return json({ id }, 201);
    }
    const accountMatch = path.match(/^\/api\/accounts\/([0-9a-f-]+)$/i);
    if (accountMatch && request.method === 'PUT') {
      const id = uuid(accountMatch[1]);
      await accountExists(env.DB, user.id, id);
      const name = text(data.name, 'account name', 60),
        kind = data.kind;
      if (!['cash', 'bank', 'savings'].includes(String(kind)))
        throw new ApiError(400, 'Choose an account type.');
      const previous = data.previous as Record<string, unknown> | undefined;
      if (!previous) throw new ApiError(400, 'Refresh the account before editing.');
      const result = await env.DB.prepare(
        'UPDATE accounts SET name=?,kind=?,opening_balance_cents=? WHERE id=? AND owner_id=? AND name=? AND kind=? AND opening_balance_cents=? RETURNING id',
      )
        .bind(
          name,
          kind,
          amount(data.openingBalanceCents, true),
          id,
          user.id,
          text(previous.name, 'previous account name', 60),
          text(previous.kind, 'previous account type', 20),
          amount(previous.openingBalanceCents, true),
        )
        .first();
      if (!result) throw new ApiError(409, 'Account changed. Close the editor and try again.');
      return json({ id });
    }
    const entryMatch = path.match(/^\/api\/entries(?:\/([0-9a-f-]+))?$/i);
    if (entryMatch) {
      const id = uuid(entryMatch[1] || data.id);
      if (request.method === 'DELETE' && entryMatch[1]) {
        const revision = amount(data.revision);
        const result = await env.DB.prepare(
          'DELETE FROM transactions WHERE id=? AND owner_id=? AND revision=? RETURNING id',
        )
          .bind(id, user.id, revision)
          .first();
        if (!result)
          throw new ApiError(409, 'Entry changed or no longer exists. Refresh and try again.');
        return json({ id });
      }
      if (
        (request.method === 'POST' && !entryMatch[1]) ||
        (request.method === 'PUT' && entryMatch[1])
      ) {
        const accountId = uuid(data.accountId);
        await accountExists(env.DB, user.id, accountId);
        if (data.kind !== 'income' && data.kind !== 'expense')
          throw new ApiError(400, 'Choose income or expense.');
        const category = data.kind === 'income' ? 'Income' : text(data.category, 'category', 40);
        if (data.kind === 'expense' && !expenseCategories.includes(category))
          throw new ApiError(400, 'Choose a valid category.');
        const values = [
          accountId,
          data.kind,
          amount(data.amountCents),
          date(data.date),
          text(data.merchant, 'name', 100),
          category,
          text(data.note ?? '', 'note', 250, true),
        ];
        if (request.method === 'POST') {
          const same = await env.DB.prepare(
            'SELECT id FROM transactions WHERE id=? AND owner_id=? AND account_id=? AND kind=? AND amount_cents=? AND date=? AND merchant=? AND category=? AND note=?',
          )
            .bind(id, user.id, ...values)
            .first();
          if (same) return json({ id });
          await env.DB.prepare(
            'INSERT INTO transactions(id,owner_id,account_id,kind,amount_cents,date,merchant,category,note) VALUES(?,?,?,?,?,?,?,?,?)',
          )
            .bind(id, user.id, ...values)
            .run();
          return json({ id }, 201);
        }
        const result = await env.DB.prepare(
          'UPDATE transactions SET account_id=?,kind=?,amount_cents=?,date=?,merchant=?,category=?,note=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=? RETURNING id',
        )
          .bind(...values, id, user.id, amount(data.revision))
          .first();
        if (!result)
          throw new ApiError(409, 'Entry changed or no longer exists. Refresh and try again.');
        return json({ id });
      }
    }
    if (path === '/api/transfers' && request.method === 'POST') {
      const id = uuid(data.id),
        source = uuid(data.sourceAccountId),
        destination = uuid(data.destinationAccountId);
      if (source === destination) throw new ApiError(400, 'Choose two different accounts.');
      await accountExists(env.DB, user.id, source);
      await accountExists(env.DB, user.id, destination);
      // One row references both accounts: both balance effects exist together or neither exists.
      await env.DB.prepare(
        'INSERT INTO transfers(id,owner_id,source_account_id,destination_account_id,amount_cents,date,note) VALUES(?,?,?,?,?,?,?)',
      )
        .bind(
          id,
          user.id,
          source,
          destination,
          amount(data.amountCents),
          date(data.date),
          text(data.note ?? '', 'note', 250, true),
        )
        .run();
      return json({ id }, 201);
    }
    const transferMatch = path.match(/^\/api\/transfers\/([0-9a-f-]+)$/i);
    if (transferMatch && request.method === 'DELETE') {
      const result = await env.DB.prepare(
        'DELETE FROM transfers WHERE id=? AND owner_id=? RETURNING id',
      )
        .bind(uuid(transferMatch[1]), user.id)
        .first();
      if (!result) throw new ApiError(404, 'Transfer not found.');
      return json({ id: transferMatch[1] });
    }
    throw new ApiError(404, 'That action does not exist.');
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) return limited(error.message);
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    if (error instanceof Error && error.message.includes('ledger_quota_exceeded'))
      return json(
        {
          error:
            'Your ledger has reached its 25,000-record limit. Export a backup before removing records.',
        },
        409,
      );
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message))
      return json(
        { error: 'This change is already recorded. Refresh your ledger before retrying.' },
        409,
      );
    return failureResponse('ledger', requestId, 500);
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    const requestId = crypto.randomUUID();
    try {
      let response: Response;
      const guarded =
        path.startsWith('/api/') || path.startsWith('/auth/')
          ? await edgeGuard(request, env)
          : null;
      if (guarded) response = guarded;
      else if (path === '/api/health' && request.method === 'GET') response = await health(env);
      else if (path.startsWith('/auth/'))
        response = await handleAuth(request, env, undefined, requestId);
      else if (path.startsWith('/api/'))
        response = await handleApi(request, env, authenticate, requestId);
      else
        response = env.ASSETS
          ? await env.ASSETS.fetch(request)
          : new Response('Not found', { status: 404 });
      return secureResponse(response, env.MODE === 'production', requestId);
    } catch {
      return secureResponse(
        failureResponse('worker', requestId, 503),
        env.MODE === 'production',
        requestId,
      );
    }
  },
};
