import { test, expect } from '@playwright/test';
test('installed shell survives offline reload and syncs an expense once', async ({
  page,
  context,
  request,
}) => {
  const id = crypto.randomUUID();
  const response = await request.post('/api/accounts', {
    headers: { Origin: 'http://127.0.0.1:5179' },
    data: { id, name: 'Offline test ' + Date.now(), kind: 'bank', openingBalanceCents: 10000 },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto('/');
  await page.getByRole('button', { name: 'Add an entry', exact: true }).waitFor();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.getByRole('button', { name: 'Add an entry', exact: true }).waitFor();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBeTruthy();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Add an entry', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Account', exact: true }).selectOption(id);
  await dialog.getByLabel(/^Amount/).fill('2.50');
  const name = 'Offline purchase ' + Date.now();
  await page.getByLabel('Name / place', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.sync-banner')).toContainText('waiting to sync');
  await page.reload();
  await expect(page.locator('.sync-banner')).toContainText('waiting to sync');
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Retry sync', exact: true }).click();
  await expect(page.locator('.sync-banner')).not.toBeVisible({ timeout: 20000 });
  const data = await (await request.get('/api/ledger')).json();
  expect(data.entries.filter((e: any) => e.merchant === name)).toHaveLength(1);
});
