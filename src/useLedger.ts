import { useCallback, useEffect, useRef, useState } from 'react';
import { emptySnapshot, type Snapshot, type LedgerEntry } from './models';
import {
  pendingFor,
  savePending,
  removePending,
  saveSnapshot,
  readCached,
  lockCache,
  withPending,
  type PendingEntry,
} from './offline';
import { RequestError, request } from './request';
import { loadSnapshot } from './ledgerClient';
import { syncPending } from './sync';
export { RequestError, request } from './request';
export function useLedger() {
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'signed-out'>('loading');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine),
    [pending, setPending] = useState<PendingEntry[]>([]),
    [syncMessage, setSyncMessage] = useState('');
  const base = useRef<Snapshot>(emptySnapshot),
    mutating = useRef(false),
    syncing = useRef<Promise<void> | null>(null),
    version = useRef<number | null>(null);
  const show = useCallback((value: Snapshot, queue: PendingEntry[]) => {
    base.current = value;
    setPending(queue);
    setSnapshot(withPending(value, queue));
    setState('ready');
    setError('');
  }, []);
  const refresh = useCallback(
    async (force = false): Promise<void> => {
      if (syncing.current) return syncing.current;
      if (mutating.current && !force) return;
      const task = (async () => {
        try {
          const latest = await request<{ version: number; ownerId: string }>('/api/ledger/version');
          let value = base.current;
          let changed =
            force || latest.ownerId !== value.user.id || latest.version !== version.current;
          if (changed) {
            const loaded = await loadSnapshot();
            value = loaded.snapshot;
            version.current = loaded.version;
          }
          let queue: PendingEntry[] = [];
          try {
            queue = await pendingFor(value.user.id);
            setSyncMessage('');
          } catch {
            setSyncMessage(
              'Offline storage is unavailable in this browser. Keep a connection while entering records.',
            );
          }
          if (queue.length) {
            await syncPending(queue);
            const synced = await request<{ version: number; ownerId: string }>(
              '/api/ledger/version',
            );
            if (synced.version !== version.current || synced.ownerId !== value.user.id) {
              const loaded = await loadSnapshot();
              value = loaded.snapshot;
              version.current = loaded.version;
              changed = true;
            }
          }
          try {
            queue = await pendingFor(value.user.id);
            if (changed) await saveSnapshot(value);
          } catch {}
          show(value, queue);
          setOffline(false);
        } catch (e) {
          if (e instanceof RequestError && e.status === 401) {
            await lockCache().catch(() => {});
            setSnapshot(emptySnapshot);
            setState('signed-out');
            setError('Sign in again to sync your ledger. Pending entries remain on this device.');
            throw e;
          }
          if (!(e instanceof RequestError)) {
            try {
              const cached = await readCached();
              if (cached) {
                show(cached, await pendingFor(cached.user.id));
                setOffline(true);
                return;
              }
            } catch {}
          }
          setSnapshot(emptySnapshot);
          setState('error');
          setError(e instanceof Error ? e.message : 'Unable to load your ledger.');
          throw e;
        }
      })();
      syncing.current = task;
      try {
        await task;
      } finally {
        syncing.current = null;
      }
    },
    [show],
  );
  useEffect(() => {
    void refresh().catch(() => {});
    const online = () => void refresh().catch(() => {});
    const off = () => setOffline(true);
    const visible = () => {
      if (document.visibilityState === 'visible') online();
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', off);
    window.addEventListener('focus', online);
    document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible' && !mutating.current) online();
    }, 60000);
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel('monthwise') : null;
    if (channel)
      channel.onmessage = () => {
        base.current = emptySnapshot;
        setSnapshot(emptySnapshot);
        setPending([]);
        setState('signed-out');
        setError('You signed out.');
      };
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', off);
      window.removeEventListener('focus', online);
      document.removeEventListener('visibilitychange', visible);
      clearInterval(timer);
      channel?.close();
    };
  }, [refresh]);
  async function queueEntry(data: unknown) {
    const entry = data as LedgerEntry;
    if (!base.current.user.id || !base.current.accounts.some((a) => a.id === entry.accountId))
      throw Error('Open your ledger online first.');
    const queued = { ...entry, revision: 1 };
    await savePending({ id: entry.id, ownerId: base.current.user.id, entry: queued });
    show(base.current, await pendingFor(base.current.user.id));
    setOffline(true);
  }
  const mutate = async (path: string, method: string, data: unknown) => {
    if (mutating.current) throw Error('A change is already being saved.');
    mutating.current = true;
    setBusy(true);
    try {
      if (syncing.current) await syncing.current;
      if (!navigator.onLine) {
        if (path === '/api/entries' && method === 'POST') {
          await queueEntry(data);
          return;
        }
        throw Error(
          'Connect to the internet for this change. You can add income and expenses offline.',
        );
      }
      try {
        await request(path, method, data);
      } catch (e) {
        if (!(e instanceof RequestError) && path === '/api/entries' && method === 'POST') {
          await queueEntry(data);
          return;
        }
        if (e instanceof RequestError && e.status === 401) {
          await lockCache().catch(() => {});
          setSnapshot(emptySnapshot);
          setState('signed-out');
        }
        if (e instanceof RequestError && e.status === 409) await refresh(true).catch(() => {});
        throw e;
      }
      await refresh(true);
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  };
  async function discardPending(id: string) {
    await removePending(id);
    show(base.current, await pendingFor(base.current.user.id));
  }
  return {
    ...snapshot,
    state,
    error,
    busy,
    refresh,
    mutate,
    offline,
    pending,
    pendingCount: pending.length,
    syncMessage,
    discardPending,
  };
}
