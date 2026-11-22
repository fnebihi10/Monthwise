import { useCallback, useEffect, useRef, useState } from 'react';
import { emptySnapshot, type Snapshot, type LedgerEntry } from './models';
import {
  pendingFor,
  savePending,
  removePending,
  saveSnapshot,
  readCached,
  cacheOwner,
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
    [syncMessage, setSyncMessage] = useState(''),
    [refreshWarning, setRefreshWarning] = useState(false),
    [refreshing, setRefreshing] = useState(false);
  const base = useRef<Snapshot>(emptySnapshot),
    session = useRef(0),
    mutating = useRef(false),
    syncing = useRef<Promise<void> | null>(null),
    version = useRef<number | null>(null);
  const clearView = useCallback(() => {
    base.current = emptySnapshot;
    version.current = null;
    setSnapshot(emptySnapshot);
    setPending([]);
    setRefreshWarning(false);
    setSyncMessage('');
  }, []);
  const signedOut = useCallback(
    (message: string) => {
      session.current++;
      clearView();
      setState('signed-out');
      setError(message);
    },
    [clearView],
  );
  const show = useCallback((value: Snapshot, queue: PendingEntry[]) => {
    base.current = value;
    setPending(queue);
    setSnapshot(withPending(value, queue));
    setState('ready');
    setError('');
  }, []);
  const refresh = useCallback(
    async (mode: 'sync' | 'read' = 'sync'): Promise<void> => {
      if (syncing.current) return syncing.current;
      if (mutating.current && mode === 'sync') return;
      const activeSession = session.current;
      const checkSession = () => {
        if (activeSession !== session.current) throw Error('The ledger session ended.');
      };
      setRefreshing(true);
      const task = (async () => {
        let authenticatedOwner: string | null = null;
        let previousOwner = base.current.user.id;
        const observeOwner = async (ownerId: string) => {
          checkSession();
          authenticatedOwner = ownerId;
          if (previousOwner && previousOwner !== ownerId) {
            clearView();
            setState('loading');
            await lockCache().catch(() => {});
            checkSession();
          }
          previousOwner = ownerId;
        };
        try {
          const latest = await request<{ version: number; ownerId: string }>('/api/ledger/version');
          previousOwner ||= (await cacheOwner().catch(() => null)) || '';
          await observeOwner(latest.ownerId);
          let value = base.current;
          let loadedVersion = version.current;
          let changed = latest.ownerId !== value.user.id || latest.version !== loadedVersion;
          if (changed) {
            const loaded = await loadSnapshot(observeOwner);
            value = loaded.snapshot;
            loadedVersion = loaded.version;
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
          checkSession();
          if (queue.length && mode === 'sync') {
            await syncPending(queue);
            const synced = await request<{ version: number; ownerId: string }>(
              '/api/ledger/version',
            );
            await observeOwner(synced.ownerId);
            if (synced.version !== loadedVersion || synced.ownerId !== value.user.id) {
              const loaded = await loadSnapshot(observeOwner);
              value = loaded.snapshot;
              loadedVersion = loaded.version;
              changed = true;
            }
            queue = await pendingFor(value.user.id).catch(() => []);
          }
          checkSession();
          if (changed) {
            await saveSnapshot(value).catch(() => {});
            if (activeSession !== session.current) await lockCache().catch(() => {});
          }
          checkSession();
          version.current = loadedVersion;
          show(value, queue);
          setOffline(false);
          setRefreshWarning(false);
        } catch (e) {
          if (activeSession !== session.current) throw e;
          if (e instanceof RequestError && (e.status === 401 || e.status === 403)) {
            signedOut('Sign in to open your ledger.');
            await lockCache().catch(() => {});
            throw e;
          }
          if (base.current.user.id) {
            setRefreshWarning(true);
            setOffline(!navigator.onLine || !(e instanceof RequestError));
            throw e;
          }
          if (!(e instanceof RequestError)) {
            try {
              const cached = await readCached();
              if (cached && (!authenticatedOwner || cached.user.id === authenticatedOwner)) {
                const queue = await pendingFor(cached.user.id);
                checkSession();
                show(cached, queue);
                setOffline(true);
                return;
              }
            } catch {}
          }
          checkSession();
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
        setRefreshing(false);
      }
    },
    [clearView, show, signedOut],
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
    if (channel) channel.onmessage = () => signedOut('You signed out.');
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', off);
      window.removeEventListener('focus', online);
      document.removeEventListener('visibilitychange', visible);
      clearInterval(timer);
      channel?.close();
    };
  }, [refresh, signedOut]);
  async function queueEntry(data: unknown) {
    const entry = data as LedgerEntry;
    const current = base.current;
    if (!current.user.id || !current.accounts.some((a) => a.id === entry.accountId))
      throw Error('Open your ledger online first.');
    const queued = { ...entry, revision: 1 };
    await savePending({ id: entry.id, ownerId: current.user.id, entry: queued });
    const queue = await pendingFor(current.user.id);
    if (base.current !== current) throw Error('The ledger session ended.');
    show(current, queue);
    setOffline(true);
  }
  const mutate = async (
    path: string,
    method: string,
    data: unknown,
  ): Promise<'saved' | 'queued'> => {
    if (mutating.current) throw Error('A change is already being saved.');
    mutating.current = true;
    setBusy(true);
    try {
      const owner = base.current.user.id;
      if (syncing.current) await syncing.current.catch(() => {});
      if (!owner || owner !== base.current.user.id) throw Error('Open your ledger again to save.');
      if (!navigator.onLine) {
        if (path === '/api/entries' && method === 'POST') {
          await queueEntry(data);
          return 'queued';
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
          return 'queued';
        }
        if (e instanceof RequestError && e.status === 401) {
          signedOut('Sign in to open your ledger.');
          await lockCache().catch(() => {});
        }
        if (e instanceof RequestError && e.status === 409) await refresh('read').catch(() => {});
        throw e;
      }
      void refresh('read').catch(() => {});
      return 'saved';
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
    refreshing,
    refreshWarning,
    mutate,
    offline,
    pending,
    pendingCount: pending.length,
    syncMessage,
    discardPending,
  };
}
