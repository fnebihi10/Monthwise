import * as oauth from 'oauth4webapi';
import { recordFailure } from './diagnostics';
import {
  allowedUser,
  accessConfigured,
  configuredOrigin,
  cookie,
  hashToken,
  LOGIN_COOKIE,
  randomToken,
  readCookie,
  SESSION_COOKIE,
  SESSION_SECONDS,
  verifyGoogleIdToken,
  type AuthEnv,
  type Identity,
} from './auth';
export type GoogleAuthEnv = AuthEnv & { DB: D1Database };
const server: oauth.AuthorizationServer = {
  issuer: 'https://accounts.google.com',
  authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: 'https://oauth2.googleapis.com/token',
  jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
  code_challenge_methods_supported: ['S256'],
};
type Attempt = { verifier: string; nonce: string };
export async function exchangeGoogleCode(
  code: string,
  attempt: Attempt,
  state: string,
  env: GoogleAuthEnv,
): Promise<Identity> {
  const client: oauth.Client = {
    client_id: env.GOOGLE_CLIENT_ID!,
    id_token_signed_response_alg: 'RS256',
  };
  const params = oauth.validateAuthResponse(
    server,
    client,
    new URLSearchParams({ code, state }),
    state,
  );
  const response = await oauth.authorizationCodeGrantRequest(
    server,
    client,
    oauth.ClientSecretPost(env.GOOGLE_CLIENT_SECRET!),
    params,
    configuredOrigin(env)! + '/auth/google/callback',
    attempt.verifier,
    { signal: AbortSignal.timeout(10000) },
  );
  const result = await oauth.processAuthorizationCodeResponse(server, client, response, {
    expectedNonce: attempt.nonce,
    requireIdToken: true,
  });
  return verifyGoogleIdToken(result.id_token!, env, attempt.nonce);
}
const securityHeaders = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};
function redirect(location: string, cookies: string[] = []) {
  const headers = new Headers({ ...securityHeaders, Location: location });
  cookies.forEach((value) => headers.append('Set-Cookie', value));
  return new Response(null, { status: 303, headers });
}
function problem(message: string, status: number, clearLogin = false) {
  const headers = new Headers({ ...securityHeaders, 'Content-Type': 'text/html; charset=utf-8' });
  if (clearLogin) headers.append('Set-Cookie', cookie(LOGIN_COOKIE, '', 0));
  return new Response(
    `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Monthwise — Sign in</title><style>body{background:#f4f1e9;color:#282923;font:16px system-ui;padding:10vh 24px;max-width:600px;margin:auto}h1{font:48px Georgia}p{line-height:1.8}a{color:#b4472c}</style><h1>Just for you.</h1><p>${message}</p><a href="/">Back to Monthwise</a></html>`,
    { status, headers },
  );
}
export type AuthServices = {
  exchange: (
    code: string,
    attempt: Attempt,
    state: string,
    env: GoogleAuthEnv,
  ) => Promise<Identity>;
};
export async function handleAuth(
  request: Request,
  env: GoogleAuthEnv,
  services: AuthServices = { exchange: exchangeGoogleCode },
  requestId = crypto.randomUUID(),
): Promise<Response> {
  const url = new URL(request.url);
  const origin = configuredOrigin(env);
  if (!origin || url.origin !== origin)
    return problem('Google sign-in is not configured for this address yet.', 503);
  try {
    if (url.pathname === '/auth/logout') {
      if (request.method !== 'POST') return problem('Use the sign-out button in Monthwise.', 405);
      if (
        request.headers.get('origin') !== origin ||
        request.headers.get('sec-fetch-site') === 'cross-site'
      )
        return problem('Open Monthwise to sign out.', 403);
      const token = readCookie(request, SESSION_COOKIE);
      if (token)
        await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?')
          .bind(await hashToken(token))
          .run();
      return redirect('/', [cookie(SESSION_COOKIE, '', 0), cookie(LOGIN_COOKIE, '', 0)]);
    }
    if (request.method !== 'GET') return problem('This sign-in action is not available.', 405);
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !accessConfigured(env))
      return problem('Google sign-in setup is not finished yet.', 503);
    const now = Math.floor(Date.now() / 1000);
    if (url.pathname === '/auth/google') {
      const key = await hashToken(request.headers.get('CF-Connecting-IP') || 'local');
      const window = Math.floor(now / 60);
      const rate = await env.DB.batch([
        env.DB.prepare(
          'INSERT INTO auth_rate_limits(key_hash,window,count) VALUES(?,?,1) ON CONFLICT(key_hash,window) DO UPDATE SET count=count+1 RETURNING count',
        ).bind(key, window),
        env.DB.prepare('DELETE FROM auth_rate_limits WHERE window<?').bind(window - 2),
        env.DB.prepare('DELETE FROM oauth_attempts WHERE expires_at<=?').bind(now),
        env.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now),
      ]);
      if (Number((rate[0].results[0] as { count: number }).count) > 20)
        return problem('Too many sign-in attempts. Please wait a minute and try again.', 429);
      const state = oauth.generateRandomState(),
        browser = randomToken(),
        verifier = oauth.generateRandomCodeVerifier(),
        nonce = randomToken();
      await env.DB.prepare(
        'INSERT INTO oauth_attempts(state_hash,browser_hash,verifier,nonce,expires_at) VALUES(?,?,?,?,?)',
      )
        .bind(await hashToken(state), await hashToken(browser), verifier, nonce, now + 600)
        .run();
      const authorization = new URL(server.authorization_endpoint!);
      authorization.search = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: origin + '/auth/google/callback',
        response_type: 'code',
        scope: 'openid email',
        state,
        nonce,
        code_challenge: await oauth.calculatePKCECodeChallenge(verifier),
        code_challenge_method: 'S256',
        prompt: 'select_account',
        ...(env.ACCESS_MODE !== 'public' && env.OWNER_EMAIL ? { login_hint: env.OWNER_EMAIL } : {}),
      }).toString();
      return redirect(authorization.href, [cookie(LOGIN_COOKIE, browser, 600)]);
    }
    if (url.pathname === '/auth/google/callback') {
      const states = url.searchParams.getAll('state'),
        codes = url.searchParams.getAll('code');
      const state = states.length === 1 ? states[0] : '',
        browser = readCookie(request, LOGIN_COOKIE);
      if (!state || state.length > 200 || !browser)
        return problem(
          'This sign-in attempt expired or belongs to a different browser. Please start again.',
          400,
          true,
        );
      const attempt = await env.DB.prepare(
        'DELETE FROM oauth_attempts WHERE state_hash=? AND browser_hash=? AND expires_at>? RETURNING verifier,nonce',
      )
        .bind(await hashToken(state), await hashToken(browser), now)
        .first<Attempt>();
      if (!attempt)
        return problem(
          'This sign-in attempt expired or was already used. Please start again.',
          400,
          true,
        );
      if (
        url.searchParams.has('error') ||
        codes.length !== 1 ||
        !codes[0] ||
        codes[0].length > 4096
      )
        return problem(
          'Google sign-in was cancelled or could not be completed. Please try again.',
          400,
          true,
        );
      const user = await services.exchange(codes[0], attempt, state, env);
      if (user.local || !user.id.startsWith('google:') || !allowedUser(user.email, env))
        return problem('This is a private app. That Google account is not allowed.', 403, true);
      const token = randomToken();
      const old = readCookie(request, SESSION_COOKIE);
      await env.DB.batch([
        env.DB.prepare('INSERT INTO users(id) VALUES(?) ON CONFLICT(id) DO NOTHING').bind(user.id),
        env.DB.prepare(
          'INSERT INTO sessions(token_hash,user_id,email,expires_at,issued_at) VALUES(?,?,?,?,?)',
        ).bind(await hashToken(token), user.id, user.email, now + SESSION_SECONDS, now),
        env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(
          old ? await hashToken(old) : '',
        ),
        env.DB.prepare(
          'DELETE FROM sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY issued_at DESC,rowid DESC LIMIT 10)',
        ).bind(user.id, user.id),
      ]);
      return redirect('/', [
        cookie(SESSION_COOKIE, token, SESSION_SECONDS),
        cookie(LOGIN_COOKIE, '', 0),
      ]);
    }
    return problem('This page does not exist.', 404);
  } catch {
    // Never log authorization codes, cookies, ID tokens or client secrets.
    recordFailure('auth', requestId, 401);
    return problem(
      'Sign-in could not be completed. Please select a verified Google account and try again. Reference: ' +
        requestId,
      401,
      true,
    );
  }
}
