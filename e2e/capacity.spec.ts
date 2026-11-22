import { test, expect } from '@playwright/test';
import { emptySnapshot, type LedgerEntry } from '../src/models';

for (const entryCount of [100, 24999]) {
  test(`a synthetic ledger with ${entryCount} entries loads and refreshes on mobile`, async ({
    page,
    browserName,
  }, info) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.setFixedTime(new Date(2026, 9, 15, 12));
    if (browserName === 'chromium') {
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    const user = { id: 'synthetic-capacity', email: 'Synthetic workspace', local: true };
    const entries: LedgerEntry[] = Array.from({ length: entryCount }, (_, index) => ({
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
    let version = 1;
    // A small per-response delay makes the sequential network cost observable.
    const responseDelayMs = 25;
    const delay = () => new Promise((resolve) => setTimeout(resolve, responseDelayMs));
    await page.route('**/api/ledger/version', async (route) => {
      await delay();
      return route.fulfill({ json: { ownerId: user.id, version } });
    });
    await page.route('**/api/entries', async (route) => {
      const entry: LedgerEntry = { ...route.request().postDataJSON(), revision: 1 };
      entries.push(entry);
      version++;
      await delay();
      return route.fulfill({ status: 201, json: entry });
    });
    let pages = 0;
    await page.route('**/api/ledger?*', async (route) => {
      const cursor = new URL(route.request().url()).searchParams.get('entriesAfter');
      const start = cursor ? entries.findIndex((entry) => entry.id === cursor) + 1 : 0;
      const batch = entries.slice(start, start + 500);
      pages++;
      await delay();
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
                balanceCents: 3000000 - entries.length * 100,
              },
            ],
            entries: batch,
          },
          version,
          next: {
            entries: start + 500 < entries.length ? batch.at(-1)!.id : null,
            transfers: null,
          },
        },
      });
    });
    const started = performance.now();
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Add an entry', exact: true })).toBeVisible();
    const loadedMs = Math.round(performance.now() - started);
    const initialPages = pages;
    expect(initialPages).toBe(Math.ceil(entryCount / 500));
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(page.getByText(`${entryCount} matching entries`, { exact: true })).toBeVisible();
    expect(await page.locator('.history-list > li').count()).toBe(30);
    const merchant = `Synthetic purchase ${entryCount - 1}`;
    const searchStarted = performance.now();
    await page.getByRole('textbox', { name: 'Search history' }).fill(merchant);
    await expect(page.getByText('1 matching entries', { exact: true })).toBeVisible();
    await expect(page.locator('.history-list')).toContainText(merchant);
    const searchMs = Math.round(performance.now() - searchStarted);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Add an entry', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Amount (€)', { exact: true }).fill('1.00');
    await page.getByRole('dialog').getByLabel('Date', { exact: true }).fill('2026-10-31');
    await page.getByLabel('Name / place', { exact: true }).fill('Capacity save');
    const write = page
      .waitForResponse((response) => new URL(response.url()).pathname === '/api/entries')
      .then((response) => {
        expect(response.status()).toBe(201);
        return performance.now();
      });
    const [, refreshStarted] = await Promise.all([
      page.getByRole('button', { name: 'Save entry', exact: true }).click(),
      write,
    ]);
    const measure = async (visible: Promise<unknown>) => {
      await visible;
      return Math.round(performance.now() - refreshStarted);
    };
    const [confirmationMs, refreshedMs] = await Promise.all([
      measure(
        page.locator('.feedback').filter({ hasText: 'Entry saved.' }).waitFor({ timeout: 30000 }),
      ),
      measure(page.getByRole('button', { name: 'Edit Capacity save' }).waitFor({ timeout: 30000 })),
    ]);
    const refreshPages = pages - initialPages;
    expect(refreshPages).toBe(Math.ceil((entryCount + 1) / 500));
    await info.attach('synthetic-browser-capacity.json', {
      body: JSON.stringify({
        synthetic: true,
        entriesBeforeSave: entryCount,
        responseDelayMs,
        initialPages,
        refreshPages,
        loadedMs,
        searchMs,
        confirmationMs,
        refreshedMs,
        cpuSlowdown: browserName === 'chromium' ? 4 : 1,
        browserName,
      }),
      contentType: 'application/json',
    });
    expect(loadedMs).toBeLessThan(30000);
    expect(searchMs).toBeLessThan(5000);
  });
}
