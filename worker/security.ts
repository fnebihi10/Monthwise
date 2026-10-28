import type { AuthEnv } from './auth';
import { hashToken } from './auth';
import { json, ApiError } from './common';

export function secureResponse(response: Response, production: boolean) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  );
  if (production) headers.set('Strict-Transport-Security', 'max-age=31536000');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function limited(message = 'Too many requests. Try again in a minute.') {
  const response = json({ error: message }, 429);
  response.headers.set('Retry-After', '60');
  return response;
}

// A coarse unauthenticated flood guard before any session/database work.
// Cloudflare counters are approximate and regional; D1 limits below are durable per user.
export async function edgeGuard(request: Request, env: AuthEnv): Promise<Response | null> {
  if (env.ACCESS_MODE !== 'public') return null;
  if (!env.EDGE_LIMITER) return json({ error: 'Public access is not configured yet.' }, 503);
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return json({ error: 'Open the app through its public Cloudflare address.' }, 503);
  const { success } = await env.EDGE_LIMITER.limit({ key: 'ip:' + (await hashToken(ip)) });
  return success ? null : limited();
}

export async function userRate(db: D1Database, owner: string, scope: string, limit: number) {
  const window = Math.floor(Date.now() / 60000);
  const results = await db.batch<{ count: number }>([
    db
      .prepare(
        'INSERT INTO api_rate_limits(owner_id,scope,window,count) VALUES(?,?,?,1) ON CONFLICT(owner_id,scope,window) DO UPDATE SET count=count+1 RETURNING count',
      )
      .bind(owner, scope, window),
    db.prepare('DELETE FROM api_rate_limits WHERE window<?').bind(window - 2),
  ]);
  if (results[0].results[0].count > limit)
    throw new ApiError(429, 'Too many requests. Try again in a minute.');
}
