import { hashToken, readCookie, SESSION_COOKIE, LOGIN_COOKIE, cookie, type Identity } from './auth';
import { ApiError, json } from './common';

export async function deleteAccount(
  request: Request,
  db: D1Database,
  user: Identity,
  confirmation: unknown,
) {
  if (user.local)
    throw new ApiError(403, 'Account deletion is unavailable in the local workspace.');
  if (confirmation !== 'DELETE')
    throw new ApiError(400, 'Type DELETE to confirm account deletion.');
  const token = readCookie(request, SESSION_COOKIE);
  const recent =
    token &&
    (await db
      .prepare(
        'SELECT user_id FROM sessions WHERE token_hash=? AND user_id=? AND issued_at>=? AND expires_at>?',
      )
      .bind(
        await hashToken(token),
        user.id,
        Math.floor(Date.now() / 1000) - 600,
        Math.floor(Date.now() / 1000),
      )
      .first());
  if (!recent)
    throw new ApiError(
      403,
      'Sign out and sign in again, then delete your account within ten minutes.',
    );
  const tables = [
    'allocations',
    'plans',
    'budgets',
    'goals',
    'transfers',
    'transactions',
    'accounts',
    'ledger_versions',
    'ledger_usage',
    'rate_limits',
    'api_rate_limits',
  ];
  await db.batch([
    ...tables.map((table) =>
      db.prepare('DELETE FROM ' + table + ' WHERE owner_id=?').bind(user.id),
    ),
    db.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id),
    db.prepare('DELETE FROM users WHERE id=?').bind(user.id),
  ]);
  const response = json({ deleted: true });
  response.headers.append('Set-Cookie', cookie(SESSION_COOKIE, '', 0));
  response.headers.append('Set-Cookie', cookie(LOGIN_COOKIE, '', 0));
  return response;
}
