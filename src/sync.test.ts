import { afterEach, expect, it, vi } from 'vitest';
import type { PendingEntry } from './offline';
import { syncPending } from './sync';
import { RequestError } from './request';
import { savePending, removePending } from './offline';

vi.mock('./offline', () => ({ savePending: vi.fn(), removePending: vi.fn() }));
const entry: PendingEntry = {
  id: 'entry',
  ownerId: 'owner',
  entry: {
    id: 'entry',
    accountId: 'account',
    kind: 'expense',
    amountCents: 125,
    date: '2026-10-28',
    merchant: 'Shop',
    category: 'Other',
    note: '',
    revision: 1,
  },
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each([429, 500, 503])(
  'retries an entry after a temporary HTTP %s failure without duplicating it',
  async (status) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: 'Try later' }, { status }))
      .mockResolvedValueOnce(Response.json({ id: entry.id }));
    vi.stubGlobal('fetch', fetcher);
    await syncPending([entry, { ...entry, id: 'second' }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const failed = vi.mocked(savePending).mock.calls[0][0];
    expect(failed.status).toBe(status);
    expect(removePending).not.toHaveBeenCalled();
    await syncPending([failed]);
    expect(removePending).toHaveBeenCalledWith(entry.id);
    expect(JSON.parse(fetcher.mock.calls[1][1].body).id).toBe(entry.id);
  },
);

it('recovers entries marked with an error by the previous app version', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({}));
  vi.stubGlobal('fetch', fetcher);
  await syncPending([{ ...entry, error: 'Old temporary failure' }]);
  expect(removePending).toHaveBeenCalledWith(entry.id);
});

it('keeps conflicts for review and preserves the queue when authentication expires', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ error: 'Sign in' }, { status: 401 }));
  vi.stubGlobal('fetch', fetcher);
  await syncPending([{ ...entry, error: 'Conflict', status: 409 }]);
  expect(fetcher).not.toHaveBeenCalled();
  await expect(syncPending([entry])).rejects.toBeInstanceOf(RequestError);
  expect(removePending).not.toHaveBeenCalled();
  expect(savePending).not.toHaveBeenCalled();
});

it('retains a network failure for the next retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network unavailable')));
  await syncPending([entry]);
  expect(savePending).toHaveBeenCalledWith(
    expect.objectContaining({ id: entry.id, status: undefined }),
  );
  expect(removePending).not.toHaveBeenCalled();
});
