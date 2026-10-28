import { accessConfigured, configuredOrigin, type AuthEnv } from './auth';
import { json } from './common';

export async function health(env: AuthEnv & { DB: D1Database }) {
  if (
    env.MODE !== 'local' &&
    (!accessConfigured(env) ||
      !configuredOrigin(env) ||
      !env.GOOGLE_CLIENT_ID ||
      !env.GOOGLE_CLIENT_SECRET)
  )
    return json({ status: 'unavailable' }, 503);
  const result = await env.DB.prepare('SELECT 1 FROM users LIMIT 1').all();
  return json({ status: result.success ? 'ok' : 'unavailable' }, result.success ? 200 : 503);
}
