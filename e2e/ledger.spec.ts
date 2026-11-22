import { createRequire } from 'node:module';
import { test, expect } from '@playwright/test';
import type { Snapshot } from '../src/models';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined }),
  );
});

test('the mobile dashboard shows the current month and all navigation options on first load', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 10, 15, 12));
  const monthPicker = page.getByRole('navigation', { name: 'Choose a month' });
  const currentMonth = monthPicker.locator('[aria-current="date"]');
  const june = monthPicker.getByRole('button', { name: /06 Jun/ });
  const july = monthPicker.getByRole('button', { name: /07 Jul/ });

  for (const width of [320, 390, 393]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(currentMonth).toHaveText(/Nov/);
    await expect(currentMonth).toBeInViewport({ ratio: 1 });
    await expect(monthPicker).toHaveJSProperty('scrollLeft', 0);
    await expect
      .poll(() =>
        monthPicker.evaluate((strip) => {
          const left = strip.getBoundingClientRect().left + strip.clientLeft;
          const july = strip.querySelectorAll('button')[6].getBoundingClientRect().left;
          return Math.round(Math.abs(july - left) * window.devicePixelRatio);
        }),
      )
      .toBe(0);
    await expect(page.getByRole('button', { name: 'Backup & app', exact: true })).toBeInViewport({
      ratio: 1,
    });

    await monthPicker.evaluate((strip) => {
      strip.scrollLeft = -strip.scrollWidth;
    });
    await expect(june).toBeInViewport({ ratio: 0.99 });
    await expect(july).not.toBeInViewport({ ratio: 0.01 });
    await june.click();
    await expect(currentMonth).toHaveText(/Jun/);
    await expect(currentMonth).toBeInViewport({ ratio: 1 });
    await expect(monthPicker).toHaveJSProperty('scrollLeft', 0);
  }
});
test('accounts, entries and transfers persist across reload and remain usable on mobile', async ({
  page,
}) => {
  const stamp = Date.now().toString();
  await page.goto('/');
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  const addButton = page.getByRole('button', { name: '+ Add account', exact: true });
  if (!(await page.getByRole('heading', { name: 'A home for your money.' }).isVisible()))
    await addButton.click();
  await page.getByLabel('Account name', { exact: true }).fill('Bank ' + stamp);
  await page.getByLabel('Opening balance (€)', { exact: true }).fill('100.00');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bank ' + stamp, exact: true })).toBeVisible();
  await addButton.click();
  await page.getByLabel('Account name', { exact: true }).fill('Savings ' + stamp);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('button', { name: 'Add an entry', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Account', exact: true })
    .selectOption({ label: 'Bank ' + stamp });
  await page.getByRole('dialog').getByLabel('Amount (€)', { exact: true }).fill('12,50');
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
  await page.getByRole('dialog').getByLabel('Date', { exact: true }).fill(date);
  await page.getByLabel('Name / place', { exact: true }).fill('Purchase ' + stamp);
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  await page.getByRole('textbox', { name: 'Search transactions' }).fill('Purchase ' + stamp);
  await page.getByRole('button', { name: 'Edit Purchase ' + stamp, exact: true }).click();
  await page.getByRole('dialog').getByLabel('Amount (€)', { exact: true }).fill('15.00');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  const bankCard = page
    .locator('.account-card')
    .filter({ has: page.getByRole('heading', { name: 'Bank ' + stamp, exact: true }) });
  await expect(bankCard.locator('.account-balance')).toHaveText('€85.00');
  await page.getByRole('button', { name: 'Move money ↗', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'From', exact: true })
    .selectOption({ label: 'Bank ' + stamp });
  await page
    .getByRole('combobox', { name: 'To', exact: true })
    .selectOption({ label: 'Savings ' + stamp });
  await page.getByRole('textbox', { name: 'Amount (€)', exact: true }).fill('20.00');
  await page.getByRole('button', { name: 'Record transfer', exact: true }).click();
  await expect(bankCard.locator('.account-balance')).toHaveText('€65.00');
  await page.reload();
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  await expect(bankCard.locator('.account-balance')).toHaveText('€65.00');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.getByRole('button', { name: 'The month', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search transactions' }).fill('Purchase ' + stamp);
  await page.getByRole('button', { name: 'Edit Purchase ' + stamp, exact: true }).click();
  await page.getByRole('button', { name: 'Delete this entry', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, delete entry', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Edit Purchase ' + stamp, exact: true }),
  ).toHaveCount(0);
});

test('an interrupted save cannot create a duplicate when retried', async ({ page }) => {
  const name = 'Retry check ' + Date.now();
  await page.goto('/');
  await page.getByRole('button', { name: 'Add an entry', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Amount (€)', { exact: true }).fill('1.25');
  await page.getByLabel('Name / place', { exact: true }).fill(name);
  let interrupted = false;
  await page.route('**/api/entries', async (route) => {
    if (!interrupted && route.request().method() === 'POST') {
      interrupted = true;
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await route.abort('failed');
    } else {
      await route.continue();
    }
  });
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(
    page.getByText('Entry saved on this device. Waiting to sync.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry sync', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search transactions' }).fill(name);
  await expect(page.getByRole('button', { name: 'Edit ' + name, exact: true })).toHaveCount(1);
});

test('confirms a D1 write even if refresh fails and retries by reading only', async ({
  page,
  request,
}) => {
  const name = 'Confirmed expense ' + Date.now();
  const accountId = crypto.randomUUID();
  const origin = new URL((await request.get('/api/ledger/version')).url()).origin;
  const account = await request.post('/api/accounts', {
    headers: { Origin: origin },
    data: { id: accountId, name, kind: 'cash', openingBalanceCents: 2000 },
  });
  expect(account.status()).toBe(201);
  await page.goto('/');
  await page.getByRole('button', { name: 'Add an entry', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Account', exact: true }).selectOption(accountId);
  await dialog.getByLabel('Amount (€)', { exact: true }).fill('12.50');
  await dialog.getByLabel('Name / place', { exact: true }).fill(name);
  let writes = 0;
  let failRefresh = false;
  const attemptedIds: string[] = [];
  await page.route('**/api/entries', async (route) => {
    writes++;
    attemptedIds.push(route.request().postDataJSON().id);
    if (writes === 1)
      return route.fulfill({ status: 503, json: { error: 'Write temporarily unavailable' } });
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    failRefresh = true;
    await route.fulfill({ response });
  });
  await page.route('**/api/ledger/version', (route) =>
    failRefresh
      ? route.fulfill({ status: 503, json: { error: 'Temporary refresh outage' } })
      : route.continue(),
  );
  await dialog.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Write temporarily unavailable');
  await expect(page.getByText('Entry saved.', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Entry saved.', { exact: true })).toBeVisible();
  await expect(page.getByText(/Showing the last loaded figures/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Your ledger/ })).toBeVisible();
  const readLedger = async () => (await (await request.get('/api/ledger')).json()) as Snapshot;
  expect((await readLedger()).entries.filter((entry) => entry.merchant === name)).toHaveLength(1);
  failRefresh = false;
  const retryRequests: string[] = [];
  page.on('request', (req) => {
    if (new URL(req.url()).pathname.startsWith('/api/')) retryRequests.push(req.method());
  });
  const retry = page.getByRole('button', { name: 'Retry refresh', exact: true });
  await retry.click();
  await expect(retry).not.toBeVisible();
  await page.getByRole('textbox', { name: 'Search transactions' }).fill(name);
  await expect(page.getByRole('button', { name: 'Edit ' + name, exact: true })).toBeVisible();
  expect(retryRequests.length).toBeGreaterThan(0);
  expect(new Set(retryRequests)).toEqual(new Set(['GET']));
  expect(writes).toBe(2);
  expect(attemptedIds[0]).toBe(attemptedIds[1]);
  const saved = (await readLedger()).entries.filter((entry) => entry.merchant === name);
  expect(saved).toHaveLength(1);
  expect(saved[0].amountCents).toBe(1250);
});

test('account opening balance can be corrected from its card', async ({ page, request }) => {
  const name = 'Correctable ' + Date.now();
  const id = crypto.randomUUID();
  const r = await request.post('/api/accounts', {
    headers: { Origin: 'http://127.0.0.1:5178' },
    data: { id, name, kind: 'cash', openingBalanceCents: 33500 },
  });
  expect(r.ok()).toBeTruthy();
  await page.goto('/');
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  await page.getByRole('button', { name: 'Edit account ' + name, exact: true }).click();
  const form = page.getByRole('form', { name: 'Edit account', exact: true });
  await form.getByLabel('Opening balance', { exact: true }).fill('0');
  await form.getByLabel('Type', { exact: true }).selectOption('bank');
  await form.getByRole('button', { name: 'Save account changes', exact: true }).click();
  await expect(form).not.toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  const card = page
    .locator('.account-card')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await expect(card.locator('.account-balance')).toHaveText(
    new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(0),
  );
  await expect(card.locator('.eyebrow')).toContainText('BANK');
});

test('Excel export downloads a real formatted workbook', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Backup & app', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Excel (.xlsx)', exact: true }).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toMatch(/monthwise-report-.*\.xlsx$/);
  const ExcelJS = createRequire(import.meta.url)('exceljs');
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile((await file.path())!);
  expect(book.getWorksheet('Transactions')!.getColumn(1).width).toBeGreaterThanOrEqual(16);
  expect(book.getWorksheet('Monthly summary')).toBeTruthy();
});

test('a temporary sync failure can be retried successfully without recreating the entry', async ({
  page,
}) => {
  const name = 'Temporary failure ' + Date.now();
  await page.goto('/');
  await page.getByRole('button', { name: 'Add an entry', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel(/^Amount/)
    .fill('1.25');
  await page.getByLabel('Name / place', { exact: true }).fill(name);
  let attempts = 0;
  await page.route('**/api/entries', async (route) => {
    attempts++;
    if (attempts === 1) await route.abort('failed');
    else if (attempts === 2)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Temporary server failure' }),
      });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Retry sync', exact: true }).click();
  await page.getByText('Review pending entries', { exact: true }).click();
  await expect(page.locator('.sync-details')).toContainText('Temporary server failure');
  await page.getByRole('button', { name: 'Retry sync', exact: true }).click();
  await expect(page.locator('.sync-banner')).not.toBeVisible();
  const data = await (await page.request.get('/api/ledger')).json();
  expect(data.entries.filter((e: { merchant: string }) => e.merchant === name)).toHaveLength(1);
});

test('checks revisions without downloading unchanged history and refreshes after an external change', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add an entry', exact: true }).waitFor();
  let versions = 0,
    pages = 0;
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.pathname === '/api/ledger/version') versions++;
    if (url.pathname === '/api/ledger' && url.searchParams.has('paged')) pages++;
  });
  const checked = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/ledger/version',
  );
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await checked;
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  expect(versions).toBeGreaterThan(0);
  expect(pages).toBe(0);
  const data = await (await request.get('/api/ledger')).json();
  const merchant = 'External change ' + Date.now();
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
  const response = await request.post('/api/entries', {
    headers: { Origin: 'http://127.0.0.1:5178' },
    data: {
      id: crypto.randomUUID(),
      accountId: data.accounts[0].id,
      kind: 'expense',
      amountCents: 100,
      date,
      merchant,
      category: 'Other',
      note: '',
    },
  });
  expect(response.status()).toBe(201);
  await expect
    .poll(async () => {
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      return pages;
    })
    .toBeGreaterThan(0);
  await page.getByRole('textbox', { name: 'Search transactions' }).fill(merchant);
  await expect(page.getByRole('button', { name: 'Edit ' + merchant, exact: true })).toBeVisible();
  expect(pages).toBeGreaterThan(0);
});

test('never falls back to another account cache when switching users and loading fails', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add an entry', exact: true }).waitFor();
  const original = (await (await page.request.get('/api/ledger')).json()) as Snapshot;
  expect(original.accounts.length).toBeGreaterThan(0);
  await page.route('**/api/ledger/version', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ownerId: 'google:another-user', version: 1 }),
    }),
  );
  await page.route('**/api/ledger?*', (route) => route.abort('failed'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add an entry', exact: true })).not.toBeVisible();
  const cacheLocked = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const opening = indexedDB.open('monthwise-private');
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
    });
    const locked = await new Promise<boolean>((resolve, reject) => {
      const read = db.transaction('meta').objectStore('meta').get('locked');
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    db.close();
    return locked;
  });
  expect(cacheLocked).toBe(true);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: 'Add an entry', exact: true })).not.toBeVisible();
  await context.setOffline(false);
});
