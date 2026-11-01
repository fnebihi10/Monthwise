import { test, expect } from '@playwright/test';
import { emptySnapshot, type LedgerEntry } from '../src/models';

test('a full synthetic ledger remains searchable at mobile width', async ({
  page,
  browserName,
}, info) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  if (browserName === 'chromium') {
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  const user = { id: 'synthetic-capacity', email: 'Synthetic workspace', local: true };
  const entries: LedgerEntry[] = Array.from({ length: 24999 }, (_, index) => ({
    id: `entry-${String(index).padStart(5, '0')}`,
    accountId: 'synthetic-account',
    revision: 1,
    kind: 'expense',
    amountCents: 100,
    date: '2026-10-15',
    merchant: `Synthetic purchase ${index}`,
    category: 'Other',
    note: '',
  }));
  await page.route('**/api/ledger/version', (route) =>
    route.fulfill({
      json: { ownerId: user.id, version: 1 },
    }),
  );
  let pages = 0;
  await page.route('**/api/ledger?*', (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('entriesAfter');
    const start = cursor ? entries.findIndex((entry) => entry.id === cursor) + 1 : 0;
    const batch = entries.slice(start, start + 500);
    pages++;
    return route.fulfill({
      json: {
        snapshot: {
          ...emptySnapshot,
          user,
          accounts: [
            {
              id: 'synthetic-account',
              name: 'Synthetic bank',
              kind: 'bank',
              openingBalanceCents: 3000000,
              balanceCents: 500100,
            },
          ],
          entries: batch,
        },
        version: 1,
        next: { entries: start + 500 < entries.length ? batch.at(-1)!.id : null, transfers: null },
      },
    });
  });
  const started = performance.now();
  await page.goto('/');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('24999 matching entries', { exact: true })).toBeVisible();
  const loadedMs = Math.round(performance.now() - started);
  expect(pages).toBe(50);
  expect(await page.locator('.history-list > li').count()).toBe(30);
  const searchStarted = performance.now();
  await page.getByRole('textbox', { name: 'Search history' }).fill('Synthetic purchase 24998');
  await expect(page.getByText('1 matching entries', { exact: true })).toBeVisible();
  await expect(page.locator('.history-list')).toContainText('Synthetic purchase 24998');
  const searchMs = Math.round(performance.now() - searchStarted);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await info.attach('synthetic-browser-capacity.json', {
    body: JSON.stringify({
      synthetic: true,
      records: 25000,
      pages,
      loadedMs,
      searchMs,
      cpuSlowdown: browserName === 'chromium' ? 4 : 1,
      browserName,
    }),
    contentType: 'application/json',
  });
  expect(loadedMs).toBeLessThan(30000);
  expect(searchMs).toBeLessThan(5000);
});
