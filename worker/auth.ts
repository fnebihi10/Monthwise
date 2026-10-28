import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
export type Identity = { id: string; email: string; local: boolean };
export type AuthEnv = {
  MODE?: string;
  APP_ORIGIN?: string;
  OWNER_EMAIL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  DB?: D1Database;
};
export const SESSION_COOKIE = '__Host-monthwise_session';
export const LOGIN_COOKIE = '__Host-monthwise_login';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
export function readCookie(request: Request, name: string): string | null {
  const values = (request.headers.get('cookie') || '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(name + '='));
  if (values.length !== 1) return null;
  const value = values[0].slice(name.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export function cookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export function allowedOwner(email: string, env: AuthEnv): boolean {
  return !!env.OWNER_EMAIL && email.trim().toLowerCase() === env.OWNER_EMAIL.trim().toLowerCase();
}
export function configuredOrigin(env: AuthEnv): string | null {
  try {
    if (!env.APP_ORIGIN) return null;
    const url = new URL(env.APP_ORIGIN);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
export async function verifyGoogleIdToken(
  token: string,
  env: AuthEnv,
  nonce: string,
  keys: JWTVerifyGetKey = googleKeys,
): Promise<Identity> {
  if (!env.GOOGLE_CLIENT_ID || !nonce) throw new Error('Missing authentication configuration');
  const { payload } = await jwtVerify(token, keys, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: env.GOOGLE_CLIENT_ID,
    algorithms: ['RS256'],
    requiredClaims: ['sub', 'email', 'email_verified', 'exp', 'iat', 'nonce'],
  });
  if (
    typeof payload.sub !== 'string' ||
    !payload.sub ||
    typeof payload.email !== 'string' ||
    payload.email_verified !== true ||
    payload.nonce !== nonce ||
    !allowedOwner(payload.email, env) ||
    (payload.azp !== undefined && payload.azp !== env.GOOGLE_CLIENT_ID)
  )
    throw new Error('Account is not allowed');
  return { id: 'google:' + payload.sub, email: payload.email.toLowerCase(), local: false };
}
export async function authenticate(request: Request, env: AuthEnv): Promise<Identity | null> {
  const url = new URL(request.url);
  if (
    env.MODE === 'local' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    !env.GOOGLE_CLIENT_ID &&
    !env.GOOGLE_CLIENT_SECRET
  ) {
    return { id: 'local-development-user', email: 'Local workspace', local: true };
  }
  if (!env.DB || !configuredOrigin(env) || url.origin !== configuredOrigin(env) || !env.OWNER_EMAIL)
    return null;
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const session = await env.DB.prepare(
    'SELECT user_id,email FROM sessions WHERE token_hash=? AND expires_at>?',
  )
    .bind(await hashToken(token), Math.floor(Date.now() / 1000))
    .first<{ user_id: string; email: string }>();
  if (!session || !allowedOwner(session.email, env)) return null;
  return { id: session.user_id, email: session.email, local: false };
}
