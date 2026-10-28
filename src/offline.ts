import type { Snapshot, LedgerEntry } from './models';
export type PendingEntry = {
  id: string;
  ownerId: string;
  entry: LedgerEntry;
  error?: string;
  status?: number;
};
let opening: Promise<IDBDatabase> | null = null;
function db() {
  return (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('monthwise-private', 1);
    request.onupgradeneeded = () => {
      for (const name of ['snapshots', 'pending', 'meta']) request.result.createObjectStore(name);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opening = null;
      reject(request.error);
    };
  }));
}
async function op<T>(
  store: string,
  mode: IDBTransactionMode,
  work: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, mode);
    let value: T;
    const req = work(tx.objectStore(store));
    req.onsuccess = () => {
      value = req.result as T;
    };
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export const pendingFor = async (owner: string) =>
  (await op<PendingEntry[]>('pending', 'readonly', (s) => s.getAll())).filter(
    (p) => p.ownerId === owner,
  );
export const savePending = (value: PendingEntry) =>
  op('pending', 'readwrite', (s) => s.put(value, value.id));
export const removePending = (id: string) => op('pending', 'readwrite', (s) => s.delete(id));
export async function saveSnapshot(value: Snapshot) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(['snapshots', 'meta'], 'readwrite');
    // Retain only the currently authenticated snapshot on shared browsers.
    tx.objectStore('snapshots').clear();
    tx.objectStore('snapshots').put(value, value.user.id);
    tx.objectStore('meta').put(value.user.id, 'owner');
    tx.objectStore('meta').put(false, 'locked');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function lockCache() {
  await op('meta', 'readwrite', (s) => s.put(true, 'locked'));
}
export const cacheOwner = () => op<string | undefined>('meta', 'readonly', (s) => s.get('owner'));
export async function readCached() {
  if (await op<boolean>('meta', 'readonly', (s) => s.get('locked'))) return null;
  const owner = await op<string>('meta', 'readonly', (s) => s.get('owner'));
  return owner ? await op<Snapshot>('snapshots', 'readonly', (s) => s.get(owner)) : null;
}
export async function clearPrivateData() {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(['snapshots', 'pending', 'meta'], 'readwrite');
    for (const name of ['snapshots', 'pending', 'meta']) tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  if ('BroadcastChannel' in globalThis) {
    const channel = new BroadcastChannel('monthwise');
    channel.postMessage('signout');
    channel.close();
  }
}
export function withPending(base: Snapshot, pending: PendingEntry[]): Snapshot {
  const ids = new Set(base.entries.map((e) => e.id));
  return {
    ...base,
    entries: [...base.entries, ...pending.filter((p) => !ids.has(p.id)).map((p) => p.entry)],
    accounts: base.accounts.map((a) => ({
      ...a,
      balanceCents:
        a.balanceCents +
        pending
          .filter((p) => !ids.has(p.id) && p.entry.accountId === a.id)
          .reduce(
            (sum, p) =>
              sum + (p.entry.kind === 'income' ? p.entry.amountCents : -p.entry.amountCents),
            0,
          ),
    })),
  };
}
