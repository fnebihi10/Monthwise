import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { emptySnapshot } from '../src/models';

test('an empty ledger exposes an accessible expense chart', async ({ page }) => {
  const user = { id: 'empty-accessibility-user', email: 'Empty local workspace', local: true };
  await page.route('**/api/ledger/version', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ownerId: user.id, version: 1 }),
    }),
  );
  await page.route('**/api/ledger?*', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        snapshot: { ...emptySnapshot, user },
        version: 1,
        next: { entries: null, transfers: null },
      }),
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'No expenses recorded', exact: true })).toBeVisible();
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(scan.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
});

test('main views and entry dialog meet automated WCAG A/AA checks', async ({ page, request }) => {
  const id = crypto.randomUUID();
  const response = await request.post('/api/accounts', {
    headers: { Origin: 'http://127.0.0.1:5178' },
    data: {
      id,
      name: 'Accessibility account ' + Date.now(),
      kind: 'bank',
      openingBalanceCents: 10000,
    },
  });
  expect(response.status()).toBe(201);
  await page.goto('/');
  await page.getByRole('button', { name: 'Add an entry', exact: true }).waitFor();
  for (const name of [
    'The month',
    'The whole year',
    'Accounts',
    'Plan',
    'History',
    'Backup & app',
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
      name,
    ).toEqual([]);
  }
  await page.getByRole('button', { name: 'Add an entry', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const dialogScan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    dialogScan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
