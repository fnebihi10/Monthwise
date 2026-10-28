import { RequestError, request, retryable } from './request';
import { savePending, removePending, type PendingEntry } from './offline';

export async function syncPending(queue: PendingEntry[]) {
  for (const item of queue) {
    // Old queue records have no status. Retry them too, so upgrades unblock stuck entries.
    if (
      item.error &&
      item.status !== undefined &&
      !retryable(new RequestError(item.status, item.error))
    )
      continue;
    try {
      await request('/api/entries', 'POST', item.entry);
      await removePending(item.id);
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) throw error;
      await savePending({
        ...item,
        error: error instanceof Error ? error.message : 'Could not sync. Try again.',
        status: error instanceof RequestError ? error.status : undefined,
      });
      // Avoid hammering an unavailable or rate-limited server with the remaining queue.
      if (retryable(error)) break;
    }
  }
}
