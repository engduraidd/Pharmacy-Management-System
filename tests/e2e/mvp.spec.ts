import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test.describe.configure({ mode: 'serial' });
const medicineName = `Oral Rehydration Salts · SE421 ${Date.now().toString(36)}`;
let batchId: number;
let medicineId: number;

async function login(page: Page, role: 'OWNER' | 'EMPLOYEE') {
  const username = process.env[`SEED_${role}_USERNAME`];
  const password = process.env[`SEED_${role}_PASSWORD`];
  if (!username || !password) throw new Error('Configure and seed local demo accounts before browser tests.');
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill(username);
  // Do not include passwords in Playwright fill-call logs, traces or screenshots.
  await page.locator('input[name="password"]').evaluate((element, value) => { (element as HTMLInputElement).value = value; }, password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pharmacy overview', exact: true })).toBeVisible();
}

test('owner dashboard, medicine creation, batch creation and stored reports', async ({ page }) => {
  await login(page, 'OWNER');
  await page.getByRole('link', { name: 'Medicines', exact: true }).click();
  await page.getByRole('button', { name: 'Add medicine', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Medicine name').fill(medicineName);
  await dialog.getByLabel('Brand', { exact: true }).fill('SE421 demonstration');
  await dialog.getByLabel(/Current selling price/).fill('2500');
  await dialog.getByLabel('Description').fill('Synthetic browser-verification record.');
  await dialog.getByRole('button', { name: 'Add medicine', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('textbox', { name: 'Search medicines' }).fill(medicineName);
  await expect(page.getByRole('link', { name: medicineName, exact: true })).toBeVisible();
  const medicineResponse = await page.request.get(`/api/medicines?search=${encodeURIComponent(medicineName)}`);
  medicineId = (await medicineResponse.json())[0].medicineId;
  await page.getByRole('link', { name: medicineName, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/medicines/${medicineId}$`));
  await expect(page.getByRole('heading', { name: medicineName, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Inventory & batches', exact: true }).click();
  await page.getByRole('button', { name: 'Add stock batch' }).click();
  await dialog.getByRole('combobox', { name: 'Medicine', exact: true }).selectOption(String(medicineId));
  await dialog.getByLabel('Quantity (whole units)').fill('25');
  const expiry = new Date(); expiry.setUTCDate(expiry.getUTCDate() + 90);
  await dialog.getByLabel('Expiry date').fill(expiry.toISOString().slice(0, 10));
  await dialog.getByLabel(/Supplier purchase price/).fill('1250.25');
  await dialog.getByRole('button', { name: 'Add batch', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('textbox', { name: 'Search inventory' }).fill(medicineName);
  await expect(page.getByRole('cell', { name: '1,250.25 IQD', exact: true })).toBeVisible();
  const response = await page.request.get(`/api/batches?medicineId=${medicineId}`);
  batchId = (await response.json())[0].batchId;
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Stock report', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: medicineName, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expiry report', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Expiry report', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pharmacy overview', exact: true })).toBeVisible();
  await mkdir('.local/screenshots', { recursive: true });
  await page.screenshot({ path: '.local/screenshots/mvp-dashboard.png', fullPage: true });
});

test('employee privacy, expiry alerts, sale confirmation and price history', async ({ page }) => {
  await login(page, 'EMPLOYEE');
  await expect(page.getByRole('link', { name: 'Reports', exact: true })).toHaveCount(0);
  const batchResponse = await page.request.get('/api/batches?includePurchasePrice=true');
  expect((await batchResponse.text()).includes('supplierPurchasePrice')).toBe(false);
  expect((await page.request.get(`/api/batches/${batchId}/purchase-price`)).status()).toBe(403);
  expect((await page.request.get('/api/reports/stock')).status()).toBe(403);
  await page.getByRole('link', { name: 'Inventory & batches', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: /Purchase price/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Expiry alerts', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Expiry alerts', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Expired', exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Sales', exact: true }).click();
  await page.getByLabel('Select medicine').selectOption(String(medicineId));
  await page.getByLabel('Select eligible batch').selectOption(String(batchId));
  await page.getByLabel('Sale quantity').fill('26');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Review sale total' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Insufficient stock' })).toBeVisible();
  await page.getByRole('button', { name: `Remove ${medicineName}` }).click();
  await page.getByLabel('Select medicine').selectOption(String(medicineId));
  await page.getByLabel('Select eligible batch').selectOption(String(batchId));
  await page.getByLabel('Sale quantity').fill('2');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Review sale total' }).click();
  await expect(page.locator('.total-amount')).toHaveText('5,000.00 IQD');
  await page.getByRole('button', { name: 'Confirm & save sale' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Stock quantities have been updated' })).toBeVisible();
  const stocks = await (await page.request.get(`/api/batches?medicineId=${medicineId}`)).json();
  expect(stocks.find((batch: { batchId: number }) => batch.batchId === batchId).quantity).toBe(23);
  await page.getByRole('link', { name: 'Medicines', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search medicines' }).fill(medicineName);
  await page.getByRole('button', { name: `Edit ${medicineName}`, exact: true }).click();
  await page.getByRole('dialog').getByLabel(/Current selling price/).fill('3000');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('link', { name: 'Sales', exact: true }).click();
  await page.getByRole('button', { name: 'View sale', exact: true }).first().click();
  await expect(page.getByRole('dialog').getByRole('cell', { name: '2,500.00 IQD', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('small-screen navigation remains usable without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'EMPLOYEE');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Medicines', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Medicine catalog' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
