import { test, expect } from '@playwright/test';
import { emptySnapshot } from '../src/models';

test('switching identities replaces the offline snapshot and switching back restores only that owner', async ({
  page,
}) => {
  let owner = 'Alice';
  let disconnected = false;
  await page.route('**/api/ledger/version', (route) =>
    disconnected ? route.abort('failed') : route.fulfill({ json: { ownerId: owner, version: 1 } }),
  );
  await page.route('**/api/ledger?*', (route) =>
    disconnected
      ? route.abort('failed')
      : route.fulfill({
          json: {
            snapshot: {
              ...emptySnapshot,
              user: { id: owner, email: `${owner}@example.test`, local: false },
              accounts: [
                {
                  id: `${owner}-account`,
                  name: `${owner} private bank`,
                  kind: 'bank',
                  openingBalanceCents: 10000,
                  balanceCents: 10000,
                },
              ],
            },
            version: 1,
            next: { entries: null, transfers: null },
          },
        }),
  );
  for (const [index, identity] of ['Alice', 'Bob', 'Alice'].entries()) {
    owner = identity;
    disconnected = false;
    if (index === 0) await page.goto('/');
    else await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByText(`${identity}@example.test`, { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: `${identity} private bank`, exact: true }),
    ).toBeVisible();
    const other = identity === 'Alice' ? 'Bob' : 'Alice';
    await expect(page.getByText(`${other} private bank`, { exact: true })).toHaveCount(0);
    // Read the actual persisted cache, independently of the rendered state.
    const cachedOwners = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const opening = indexedDB.open('monthwise-private');
        opening.onsuccess = () => resolve(opening.result);
        opening.onerror = () => reject(opening.error);
      });
      const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
        const read = db.transaction('snapshots').objectStore('snapshots').getAllKeys();
        read.onsuccess = () => resolve(read.result);
        read.onerror = () => reject(read.error);
      });
      db.close();
      return keys;
    });
    expect(cachedOwners).toEqual([identity]);
    disconnected = true;
    await page.reload();
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: `${identity} private bank`, exact: true }),
    ).toBeVisible();
    await expect(page.getByText(`${other} private bank`, { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Add an entry', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByLabel('Name / place', { exact: true })
      .fill(`${identity} draft`);
  }
});
