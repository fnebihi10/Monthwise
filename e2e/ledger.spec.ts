import { createRequire } from 'node:module';
import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined }),
  );
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
  await page.getByRole('dialog').getByLabel('Amount (€)', { exact: true }).fill('12.50');
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
  await page.getByRole('button', { name: 'Retry sync', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search transactions' }).fill(name);
  await expect(page.getByRole('button', { name: 'Edit ' + name, exact: true })).toHaveCount(1);
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
