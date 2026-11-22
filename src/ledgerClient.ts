import type { Snapshot, LedgerPage } from './models';
import { request } from './request';
export type { LedgerPage } from './models';

// Never expose a partially loaded ledger or mix pages from different revisions.
export async function loadSnapshot(): Promise<{ snapshot: Snapshot; version: number }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let page = await request<LedgerPage>('/api/ledger?paged=1');
    const snapshot = page.snapshot;
    const version = page.version;
    let consistent = true;
    while (page.next.entries || page.next.transfers) {
      const params = new URLSearchParams({
        paged: '1',
        entriesAfter: page.next.entries || 'done',
        transfersAfter: page.next.transfers || 'done',
      });
      page = await request<LedgerPage>('/api/ledger?' + params);
      if (page.version !== version || page.snapshot.user.id !== snapshot.user.id) {
        consistent = false;
        break;
      }
      snapshot.entries.push(...page.snapshot.entries);
      snapshot.transfers.push(...page.snapshot.transfers);
    }
    const latest = await request<{ version: number; ownerId: string }>('/api/ledger/version');
    if (consistent && latest.version === version && latest.ownerId === snapshot.user.id)
      return { snapshot, version };
  }
  throw Error('Your ledger changed while loading. Please try again.');
}
