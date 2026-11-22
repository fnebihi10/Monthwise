import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { emptySnapshot, type Snapshot } from '../src/models';

test('signed-out visitors can explore fictional figures without touching the private ledger', async ({
  page,
}) => {
  let apiCalls = 0;
  await page.route('**/api/**', (route) => {
    apiCalls++;
    return route.fulfill({ status: 401, json: { error: 'Sign in' } });
  });
  await page.addInitScript(() => {
    const open = indexedDB.open.bind(indexedDB);
    let privateStorageOpened = false;
    Object.defineProperty(window, 'privateStorageOpened', { get: () => privateStorageOpened });
    indexedDB.open = (...args) => {
      if (args[0] === 'monthwise-private') privateStorageOpened = true;
      return open(...args);
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  const callsBeforeSample = apiCalls;
  await page.getByRole('link', { name: 'View sample month' }).click();
  const summary = page.getByRole('region', { name: 'Monthly financial summary' });
  await expect(summary).toContainText('€2,000.00');
  await expect(summary).toContainText('€800.00');
  await expect(summary).toContainText('€1,200.00');
  const availability = page.getByRole('region', { name: 'Unassigned after reservations' });
  await expect(availability.locator('strong')).toHaveText('€1,175.00');
  await expect(availability).toContainText(
    '€1,600.00 across all accounts − €125.00 in this month’s unpaid bills − €300.00 set aside',
  );
  await expect(page.getByText('Electricity bill · unpaid')).toBeVisible();
  await expect(page.getByText('Emergency fund · set aside')).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(scan.violations.map((v) => v.id)).toEqual([]);
  await page.getByRole('combobox', { name: 'Filter transactions' }).selectOption('expense');
  await expect(page.getByText('Studio salary', { exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Search transactions' }).fill('market');
  await expect(page.getByText('Saturday market', { exact: true })).toBeVisible();
  await expect(page.getByText('Rail pass', { exact: true })).toHaveCount(0);
  expect(apiCalls).toBe(callsBeforeSample);
  expect(await page.evaluate(() => Reflect.get(window, 'privateStorageOpened'))).toBe(false);
  expect(errors).toEqual([]);
});

test('an empty ledger guides account setup and a keyboard-accessible first entry on mobile', async ({
  page,
}) => {
  const user = { id: 'fictional-onboarding', email: 'Local onboarding', local: true };
  const snapshot: Snapshot = { ...emptySnapshot, user, accounts: [], entries: [] };
  let version = 1;
  await page.route('**/api/ledger/version', (route) =>
    route.fulfill({ json: { ownerId: user.id, version } }),
  );
  await page.route('**/api/ledger?*', (route) =>
    route.fulfill({ json: { snapshot, version, next: { entries: null, transfers: null } } }),
  );
  await page.route('**/api/accounts', (route) => {
    const account = route.request().postDataJSON();
    snapshot.accounts.push({ ...account, balanceCents: account.openingBalanceCents });
    version++;
    return route.fulfill({ status: 201, json: account });
  });
  await page.route('**/api/entries', (route) => {
    const entry = { ...route.request().postDataJSON(), revision: 1 };
    snapshot.entries.push(entry);
    snapshot.accounts[0].balanceCents -= entry.amountCents;
    version++;
    return route.fulfill({ status: 201, json: entry });
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Set up an account' }).click();
  const name = page.getByRole('textbox', { name: 'Account name' });
  await expect(name).toBeFocused();
  await name.fill('Fictional cash');
  await page.getByLabel('Opening balance (€)', { exact: true }).fill('20.00');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('button', { name: 'Add your first entry' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'The month', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Record an entry' })).toBeVisible();
  const add = page.getByRole('button', { name: 'Add an entry', exact: true });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(add).toBeInViewport({ ratio: 1 });
    expect((await add.boundingBox())!.y).toBeLessThan(422);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await add.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(add).toBeFocused();
  }
  await add.click();
  await dialog.getByLabel('Amount (€)', { exact: true }).fill('3.00');
  await dialog.getByLabel('Name / place', { exact: true }).fill('Bus ride');
  await dialog.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByRole('button', { name: 'Edit Bus ride', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Unassigned after reservations' })).toContainText(
    '€17.00 across all accounts',
  );
  await page.getByRole('button', { name: 'View bills and savings goals' }).click();
  await expect(page.getByText('UNASSIGNED AFTER RESERVATIONS', { exact: true })).toBeVisible();
});
