import { afterEach, expect, it, vi } from 'vitest';
import { loadSnapshot, type LedgerPage } from './ledgerClient';
import { emptySnapshot, type LedgerEntry } from './models';

const user = { id: 'owner', email: 'owner@test', local: false };
const entry = (id: string) => ({ id }) as LedgerEntry;
const page = (version: number, ids: string[], next: string | null = null): LedgerPage => ({
  snapshot: { ...emptySnapshot, user, entries: ids.map(entry), transfers: [] },
  version,
  next: { entries: next, transfers: null },
});
afterEach(() => vi.unstubAllGlobals());

it('assembles all pages before returning a ledger', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(page(1, ['a'], 'a')))
    .mockResolvedValueOnce(Response.json(page(1, ['b'])))
    .mockResolvedValueOnce(Response.json({ version: 1, ownerId: user.id }));
  vi.stubGlobal('fetch', fetcher);
  const loaded = await loadSnapshot();
  expect(loaded.snapshot.entries.map((e) => e.id)).toEqual(['a', 'b']);
  expect(fetcher.mock.calls[1][0]).toContain('entriesAfter=a&transfersAfter=done');
});

it('discards mixed revisions and restarts from the first page', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json(page(1, ['old'], 'old')))
      .mockResolvedValueOnce(Response.json(page(2, ['mixed'])))
      .mockResolvedValueOnce(Response.json({ version: 2, ownerId: user.id }))
      .mockResolvedValueOnce(Response.json(page(2, ['new'])))
      .mockResolvedValueOnce(Response.json({ version: 2, ownerId: user.id })),
  );
  expect((await loadSnapshot()).snapshot.entries.map((e) => e.id)).toEqual(['new']);
});

it('rejects a snapshot if the authenticated owner changes during loading', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation(async (path: string) =>
        Response.json(
          path.endsWith('/version')
            ? { version: 1, ownerId: 'different-owner' }
            : page(1, ['private']),
        ),
      ),
  );
  await expect(loadSnapshot()).rejects.toThrow('changed while loading');
});
