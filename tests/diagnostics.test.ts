import { afterEach, expect, it, vi } from 'vitest';
import worker, { handleApi, type Env } from '../worker/index';
import { RequestError, request } from '../src/request';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('correlates server failures without logging private exception/request details', async () => {
  const logs = vi.spyOn(console, 'error').mockImplementation(() => {});
  const reference = crypto.randomUUID();
  const response = await handleApi(
    new Request('https://app.test/api/ledger?private=secret', {
      headers: { Cookie: 'sensitive-cookie' },
    }),
    {} as Env,
    async () => {
      throw new Error('owner@example.test private amount 12000 session-secret');
    },
    reference,
  );
  expect(response.status).toBe(500);
  expect(response.headers.get('X-Request-ID')).toBe(reference);
  const event = JSON.parse(logs.mock.calls[0][0]);
  expect(event).toEqual({
    event: 'request_failed',
    scope: 'ledger',
    requestId: reference,
    status: 500,
    at: expect.any(String),
  });
  expect(JSON.stringify(logs.mock.calls)).not.toMatch(
    /owner@|12000|session-secret|sensitive-cookie|private=/,
  );
});

it('adds an internally generated reference to unexpected ingress failures', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const response = await worker.fetch(
    new Request('https://app.test/api/ledger', {
      headers: { 'CF-Connecting-IP': '192.0.2.1', 'X-Request-ID': 'attacker-controlled' },
    }),
    {
      ACCESS_MODE: 'public',
      EDGE_LIMITER: {
        limit: async () => {
          throw Error('secret');
        },
      },
    } as unknown as Env,
  );
  expect(response.status).toBe(503);
  expect(response.headers.get('X-Request-ID')).toMatch(/^[a-f0-9-]{36}$/);
});

it('shows a safe error reference to users for support', async () => {
  const reference = crypto.randomUUID();
  vi.stubGlobal('fetch', async () =>
    Response.json({ error: 'Try again.' }, { status: 503, headers: { 'X-Request-ID': reference } }),
  );
  await expect(request('/api/ledger')).rejects.toMatchObject<RequestError>({
    status: 503,
    requestId: reference,
    message: 'Try again. Reference: ' + reference,
  } as RequestError);
});

it('provides a minimal no-store health check without exposing records or configuration', async () => {
  const env = {
    MODE: 'local',
    DB: { prepare: () => ({ all: async () => ({ success: true, results: [] }) }) },
  } as unknown as Env;
  const response = await worker.fetch(new Request('http://localhost/api/health'), env);
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ status: 'ok' });
  const missing = await worker.fetch(new Request('https://app.test/api/health'), {
    ...env,
    MODE: 'production',
  });
  expect(missing.status).toBe(503);
  expect(await missing.json()).toEqual({ status: 'unavailable' });
});
