import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync } from 'node:fs';
import { handleAuth, exchangeGoogleCode, type GoogleAuthEnv } from '../worker/google-auth';
import { authenticate, cookie, hashToken, LOGIN_COOKIE, SESSION_COOKIE } from '../worker/auth';
let mf: Miniflare;
let env: GoogleAuthEnv;
const origin = 'https://monthwise.test';
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
  for (const filename of [
    '0001_ledger.sql',
    '0002_google_sessions.sql',
    '0003_planning.sql',
    '0004_ledger_versions.sql',
    '0005_public_access.sql',
  ]) {
    for (const sql of readFileSync(new URL('../migrations/' + filename, import.meta.url), 'utf8')
      .split(/;(?!\s*END\b)/i)
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
  }
  env = {
    DB: db as unknown as D1Database,
    MODE: 'production',
    APP_ORIGIN: origin,
    GOOGLE_CLIENT_ID: 'client',
    GOOGLE_CLIENT_SECRET: 'test-only',
    OWNER_EMAIL: 'owner@example.test',
  };
}, 30000);
afterAll(async () => {
  await mf?.dispose();
});
function request(path: string, cookieValue = '', method = 'GET', requestOrigin = origin) {
  return new Request(origin + path, {
    method,
    headers: { cookie: cookieValue, Origin: requestOrigin },
  });
}
async function start() {
  const response = await handleAuth(request('/auth/google'), env);
  expect(response.status).toBe(303);
  const target = new URL(response.headers.get('Location')!);
  const cookieValue = response.headers.get('set-cookie')!.split(/;(?!\s*END\b)/i)[0];
  return { target, cookieValue, state: target.searchParams.get('state')! };
}
const owner = { id: 'google:subject', email: 'owner@example.test', local: false };
it('starts Google-only sign-in with PKCE, nonce and a secure browser-bound cookie', async () => {
  const { target, cookieValue } = await start();
  expect(target.origin).toBe('https://accounts.google.com');
  expect(target.searchParams.get('scope')).toBe('openid email');
  expect(target.searchParams.get('code_challenge_method')).toBe('S256');
  expect(target.searchParams.get('nonce')).toBeTruthy();
  expect(target.searchParams.get('redirect_uri')).toBe(origin + '/auth/google/callback');
  expect(cookieValue.startsWith(LOGIN_COOKIE + '=')).toBe(true);
});
it('rejects missing browser cookie and wrong state without exchanging a code', async () => {
  const { state, cookieValue } = await start();
  const never = {
    exchange: async () => {
      throw Error('Must not be called');
    },
  };
  expect(
    (await handleAuth(request('/auth/google/callback?code=x&state=' + state), env, never)).status,
  ).toBe(400);
  expect(
    (await handleAuth(request('/auth/google/callback?code=x&state=wrong', cookieValue), env, never))
      .status,
  ).toBe(400);
});
it('creates a hashed owner session, rejects callback replay and revokes logout', async () => {
  const { state, cookieValue, target } = await start();
  let exchanges = 0;
  const services = {
    exchange: async (code: string, attempt: { verifier: string; nonce: string }) => {
      exchanges++;
      expect(code).toBe('valid-code');
      expect(attempt.verifier.length).toBeGreaterThan(30);
      expect(attempt.nonce).toBe(target.searchParams.get('nonce'));
      return owner;
    },
  };
  const callback = '/auth/google/callback?code=valid-code&state=' + state;
  const response = await handleAuth(request(callback, cookieValue), env, services);
  expect(response.status).toBe(303);
  expect(exchanges).toBe(1);
  const cookies = response.headers.getSetCookie();
  const sessionCookie = cookies.find((c) => c.startsWith(SESSION_COOKIE + '='))!;
  expect(sessionCookie).toContain('HttpOnly');
  expect(sessionCookie).toContain('Secure');
  expect(sessionCookie).toContain('SameSite=Lax');
  const sessionValue = sessionCookie.split(/;(?!\s*END\b)/i)[0];
  const raw = sessionValue.slice(SESSION_COOKIE.length + 1);
  const stored = await env.DB.prepare('SELECT token_hash FROM sessions WHERE token_hash=?')
    .bind(await hashToken(raw))
    .first<{ token_hash: string }>();
  expect(stored?.token_hash).not.toBe(raw);
  expect(await authenticate(request('/api/ledger', sessionValue), env)).toEqual(owner);
  expect((await handleAuth(request(callback, cookieValue), env, services)).status).toBe(400);
  expect(exchanges).toBe(1);
  expect((await handleAuth(request('/auth/logout', sessionValue, 'GET'), env)).status).toBe(405);
  expect(
    (await handleAuth(request('/auth/logout', sessionValue, 'POST', 'https://evil.test'), env))
      .status,
  ).toBe(403);
  expect((await handleAuth(request('/auth/logout', sessionValue, 'POST'), env)).status).toBe(303);
  expect(await authenticate(request('/api/ledger', sessionValue), env)).toBeNull();
});
it('does not create a session for another account', async () => {
  const { state, cookieValue } = await start();
  const response = await handleAuth(
    request('/auth/google/callback?code=x&state=' + state, cookieValue),
    env,
    { exchange: async () => ({ ...owner, id: 'google:other', email: 'other@example.test' }) },
  );
  expect(response.status).toBe(403);
  expect(response.headers.getSetCookie().some((c) => c.startsWith(SESSION_COOKIE + '='))).toBe(
    false,
  );
});
it('rejects expired sign-in attempts and sessions and rechecks owner configuration', async () => {
  const { state, cookieValue } = await start();
  await env.DB.prepare('UPDATE oauth_attempts SET expires_at=0 WHERE state_hash=?')
    .bind(await hashToken(state))
    .run();
  expect(
    (await handleAuth(request('/auth/google/callback?code=x&state=' + state, cookieValue), env))
      .status,
  ).toBe(400);
  const raw = 'a'.repeat(64);
  await env.DB.prepare('INSERT INTO users(id) VALUES(?) ON CONFLICT(id) DO NOTHING')
    .bind(owner.id)
    .run();
  await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,email,expires_at) VALUES(?,?,?,?)')
    .bind(await hashToken(raw), owner.id, owner.email, 0)
    .run();
  expect(
    await authenticate(request('/api/ledger', cookie(SESSION_COOKIE, raw, 100)), env),
  ).toBeNull();
  await env.DB.prepare('UPDATE sessions SET expires_at=? WHERE token_hash=?')
    .bind(Math.floor(Date.now() / 1000) + 100, await hashToken(raw))
    .run();
  expect(
    await authenticate(request('/api/ledger', SESSION_COOKIE + '=' + raw), {
      ...env,
      OWNER_EMAIL: 'someone-else@test',
    }),
  ).toBeNull();
});
it('fails closed when Google setup or the HTTPS origin is missing', async () => {
  expect(
    (await handleAuth(request('/auth/google'), { ...env, GOOGLE_CLIENT_SECRET: '' })).status,
  ).toBe(503);
  expect(
    (await handleAuth(request('/auth/google'), { ...env, APP_ORIGIN: 'http://monthwise.test' }))
      .status,
  ).toBe(503);
});

it('exchanges a code through the real OAuth library and verifies the signed Google ID token', async () => {
  const keys = await generateKeyPair('RS256');
  const jwk = await exportJWK(keys.publicKey);
  jwk.kid = 'mock-google-key';
  const nonce = 'mock-nonce';
  const signed = await new SignJWT({ email: env.OWNER_EMAIL, email_verified: true, nonce })
    .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
    .setSubject('real-library-subject')
    .setIssuer('https://accounts.google.com')
    .setAudience(env.GOOGLE_CLIENT_ID!)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(keys.privateKey);
  vi.stubGlobal('fetch', async (input: string | URL | Request, options?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === 'https://oauth2.googleapis.com/token') {
      const payload = new URLSearchParams(options?.body as URLSearchParams);
      expect(payload.get('code')).toBe('mock-code');
      expect(payload.get('code_verifier')).toBe('v'.repeat(43));
      expect(payload.get('redirect_uri')).toBe(origin + '/auth/google/callback');
      return Response.json({
        access_token: 'unused',
        token_type: 'Bearer',
        expires_in: 3600,
        id_token: signed,
      });
    }
    if (url === 'https://www.googleapis.com/oauth2/v3/certs') return Response.json({ keys: [jwk] });
    throw new Error('Unexpected external endpoint');
  });
  try {
    expect(
      await exchangeGoogleCode('mock-code', { verifier: 'v'.repeat(43), nonce }, 'mock-state', env),
    ).toEqual({ id: 'google:real-library-subject', email: env.OWNER_EMAIL, local: false });
  } finally {
    vi.unstubAllGlobals();
  }
});
