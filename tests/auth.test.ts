import { beforeAll, describe, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import { authenticate, verifyGoogleIdToken, type AuthEnv } from '../worker/auth';
let privateKey: CryptoKey;
let resolver: JWTVerifyGetKey;
const env: AuthEnv = { GOOGLE_CLIENT_ID: 'google-client', OWNER_EMAIL: 'owner@example.test' };
beforeAll(async () => {
  const keys = await generateKeyPair('RS256');
  privateKey = keys.privateKey;
  const jwk = await exportJWK(keys.publicKey);
  jwk.kid = 'test';
  resolver = createLocalJWKSet({ keys: [jwk] });
});
async function token(
  overrides: Record<string, unknown> = {},
  aud = 'google-client',
  expiration = '5m',
  issuer = 'https://accounts.google.com',
) {
  return new SignJWT({
    email: 'owner@example.test',
    email_verified: true,
    nonce: 'expected-nonce',
    ...overrides,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setSubject('stable-google-subject')
    .setIssuer(issuer)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(privateKey);
}
describe('Google owner-only identity verification', () => {
  it('accepts the verified owner and keys records by Google subject', async () => {
    expect(await verifyGoogleIdToken(await token(), env, 'expected-nonce', resolver)).toEqual({
      id: 'google:stable-google-subject',
      email: 'owner@example.test',
      local: false,
    });
  });
  it('rejects wrong owners, unverified emails, nonce mismatches and authorized-party mismatches', async () => {
    for (const claims of [
      { email: 'other@example.test' },
      { email_verified: false },
      { nonce: 'wrong' },
      { azp: 'wrong-client' },
    ]) {
      await expect(
        verifyGoogleIdToken(await token(claims), env, 'expected-nonce', resolver),
      ).rejects.toThrow();
    }
  });
  it('rejects expired, wrong-audience, wrong-issuer and forged tokens', async () => {
    await expect(
      verifyGoogleIdToken(await token({}, 'wrong'), env, 'expected-nonce', resolver),
    ).rejects.toThrow();
    await expect(
      verifyGoogleIdToken(await token({}, 'google-client', '-1m'), env, 'expected-nonce', resolver),
    ).rejects.toThrow();
    await expect(
      verifyGoogleIdToken(
        await token({}, 'google-client', '5m', 'https://wrong.test'),
        env,
        'expected-nonce',
        resolver,
      ),
    ).rejects.toThrow();
    const parts = (await token()).split('.');
    parts[2] = (parts[2][0] === 'a' ? 'b' : 'a') + parts[2].slice(1);
    await expect(
      verifyGoogleIdToken(parts.join('.'), env, 'expected-nonce', resolver),
    ).rejects.toThrow();
  });
  it('ignores old Access headers and disables local identity on hosted requests', async () => {
    const request = new Request('https://monthwise.test/api/ledger', {
      headers: {
        'Cf-Access-Authenticated-User-Email': 'owner@example.test',
        'Cf-Access-Jwt-Assertion': 'forged',
      },
    });
    expect(await authenticate(request, { MODE: 'production' })).toBeNull();
    expect(await authenticate(request, { MODE: 'local' })).toBeNull();
    expect(
      await authenticate(new Request('http://localhost/api/ledger'), { MODE: 'local' }),
    ).toMatchObject({ local: true });
    expect(
      await authenticate(new Request('http://localhost/api/ledger'), { MODE: 'production' }),
    ).toBeNull();
  });
});
