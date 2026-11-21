import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
import { createApplication } from '../src/application';
import { hashPassword } from '../src/auth/password';
import { ExpiryChecker } from '../src/domain/expiry';

test('MVP acceptance against isolated persistent PostgreSQL', { timeout: 120_000 }, async t => {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error('TEST_DATABASE_URL is required. Integration tests are never silently skipped.');
  const parsed = new URL(testUrl);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.endsWith('_test')) {
    throw new Error('Integration tests require a loopback database ending in _test.');
  }
  process.env.DATABASE_URL = testUrl;
  const prismaCli = join(dirname(require.resolve('prisma/package.json')), 'build/index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], { env: process.env, stdio: 'pipe' });
  const db = new PrismaClient();
  const app = await createApplication();
  const marker = randomUUID().slice(0, 8);
  const ownerPassword = randomBytes(24).toString('hex');
  const employeePassword = randomBytes(24).toString('hex');
  const owner = await db.user.create({ data: { username: `owner-${marker}`, fullName: 'Integration Owner', role: 'OWNER', passwordHash: await hashPassword(ownerPassword) } });
  const employee = await db.user.create({ data: { username: `employee-${marker}`, fullName: 'Integration Employee', role: 'EMPLOYEE', passwordHash: await hashPassword(employeePassword) } });
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  let ownerCookie = '';
  let employeeCookie = '';
  let medicineId = 0;
  let validId = 0;
  let expiredId = 0;
  let nearId = 0;
  let saleId = 0;
  const date = (days: number) => { const d = new ExpiryChecker().today(); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  const request = async (path: string, cookie = '', method = 'GET', body?: unknown, origin?: string) => {
    const result = await fetch(`${base}${path}`, { method, headers: {
      ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(origin ? { Origin: origin } : {}),
    }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: result.status, body: await result.json() as any, headers: result.headers };
  };
  const assertNoCosts = (body: unknown) => assert.ok(!JSON.stringify(body).includes('supplierPurchasePrice'), 'Employee response must not contain purchase price fields.');
  const confirm = (batchId: number, quantity: number, requestKey = randomUUID()) => ({
    requestKey, items: [{ batchId, quantity, expectedUnitPrice: '2500.1250' }],
  });
  try {
    await t.test('1–2: owner and employee log in with secure revocable cookies', async () => {
      const a = await request('/auth/login', '', 'POST', { username: owner.username, password: ownerPassword });
      const b = await request('/auth/login', '', 'POST', { username: employee.username, password: employeePassword });
      assert.equal(a.status, 201); assert.equal(b.status, 201);
      ownerCookie = a.headers.get('set-cookie')!.split(';')[0]!;
      employeeCookie = b.headers.get('set-cookie')!.split(';')[0]!;
      assert.match(a.headers.get('set-cookie')!, /HttpOnly/i);
      assert.match(a.headers.get('set-cookie')!, /SameSite=Strict/i);
      assert.equal(a.body.user.role, 'OWNER'); assert.equal(b.body.user.role, 'EMPLOYEE');
      assert.ok(!JSON.stringify(a.body).includes('passwordHash'));
      const session = await db.session.findFirst({ where: { userId: owner.userId } });
      assert.ok(session && session.tokenHash !== ownerCookie.split('=')[1]);
      const bad = await request('/auth/login', '', 'POST', { username: owner.username, password: randomBytes(16).toString('hex') });
      assert.equal(bad.status, 401);
    });
    await t.test('3 and 6: authenticated medicine CRUD/search; backend validation and Origin protection', async () => {
      assert.equal((await request('/medicines')).status, 401);
      assert.equal((await request('/medicines', employeeCookie, 'POST', { name: '' })).status, 400);
      const data = { name: `Acceptance ${marker}`, brand: 'Synthetic', description: 'Test data', barcode: `T-${marker}`, currentSellingPrice: '2500.1250' };
      assert.equal((await request('/medicines', ownerCookie, 'POST', data, 'https://untrusted.invalid')).status, 403);
      const created = await request('/medicines', employeeCookie, 'POST', data);
      assert.equal(created.status, 201); medicineId = created.body.medicineId;
      assert.equal((await db.medicine.findUniqueOrThrow({ where: { medicineId } })).name, data.name);
      assert.equal((await request(`/medicines?search=${marker}`, ownerCookie)).body.length, 1);
      assert.equal((await request(`/medicines/${medicineId}`, employeeCookie)).status, 200);
    });
    await t.test('4–5 and 7: stored batches, owner costs, employee privacy on direct routes', async () => {
      const add = async (days: number, quantity: number) => request('/batches', ownerCookie, 'POST', {
        medicineId, quantity, expiryDate: date(days), supplierPurchasePrice: '1234.5678',
      });
      const valid = await add(90, 20); const expired = await add(-1, 4); const near = await add(5, 10);
      assert.equal(valid.status, 201); assert.equal(expired.status, 201); assert.equal(near.status, 201);
      validId = valid.body.batchId; expiredId = expired.body.batchId; nearId = near.body.batchId;
      assert.equal((await db.stockBatch.findUniqueOrThrow({ where: { batchId: validId } })).quantity, 20);
      const cost = await request(`/batches/${validId}/purchase-price`, ownerCookie);
      assert.equal(cost.status, 200); assert.ok(new Prisma.Decimal(cost.body.supplierPurchasePrice).equals('1234.5678'));
      for (const path of [`/batches/${validId}/purchase-price`, '/reports/stock', '/reports/expiry']) {
        const denied = await request(path, employeeCookie); assert.equal(denied.status, 403); assertNoCosts(denied.body);
      }
      assert.equal((await request(`/batches/${validId}/purchase-price`, employeeCookie, 'PATCH', { supplierPurchasePrice: '100' })).status, 403);
      assert.equal((await request('/batches', employeeCookie, 'POST', { medicineId, quantity: 1, expiryDate: date(90), supplierPurchasePrice: '100' })).status, 403);
      const staffBatch = await request('/batches', employeeCookie, 'POST', { medicineId, quantity: 2, expiryDate: date(90) });
      assert.equal(staffBatch.status, 201); assertNoCosts(staffBatch.body);
      assert.equal((await db.stockBatch.findUniqueOrThrow({ where: { batchId: staffBatch.body.batchId } })).supplierPurchasePrice, null);
      for (const path of ['/batches?includePurchasePrice=true', `/batches?medicineId=${medicineId}`, '/expiry-alerts', '/dashboard', '/medicines']) {
        const data = await request(path, employeeCookie); assert.equal(data.status, 200); assertNoCosts(data.body);
      }
      assert.equal((await request('/batches', ownerCookie, 'POST', { medicineId, quantity: -1, expiryDate: date(90), supplierPurchasePrice: '1' })).status, 400);
      assert.equal((await request('/batches', ownerCookie, 'POST', { medicineId, quantity: 1, expiryDate: '2026-02-30', supplierPurchasePrice: '1' })).status, 400);
    });
    await t.test('8: expiry alerts distinguish stored expired, near-expiry and valid batches', async () => {
      const alerts = await request('/expiry-alerts', employeeCookie);
      assert.equal(alerts.body.find((b: any) => b.batchId === expiredId).status, 'EXPIRED');
      assert.equal(alerts.body.find((b: any) => b.batchId === nearId).status, 'EXPIRING');
      assert.ok(!alerts.body.some((b: any) => b.batchId === validId));
    });
    await t.test('9–10: expired/insufficient stock rejected with no database changes', async () => {
      assert.equal((await request('/sales', employeeCookie, 'POST', confirm(expiredId, 1))).status, 400);
      assert.equal((await request('/sales', employeeCookie, 'POST', confirm(validId, 21))).status, 400);
      assert.equal((await db.stockBatch.findUniqueOrThrow({ where: { batchId: validId } })).quantity, 20);
      assert.equal(await db.sale.count({ where: { userId: employee.userId } }), 0);
    });
    await t.test('11: multi-item sale is stored atomically and retry is idempotent', async () => {
      const payload = { requestKey: randomUUID(), items: [{ batchId: validId, quantity: 2, expectedUnitPrice: '2500.1250' }, { batchId: nearId, quantity: 1, expectedUnitPrice: '2500.1250' }] };
      const preview = await request('/sales/preview', employeeCookie, 'POST', { items: payload.items });
      assert.equal(preview.body.totalAmount, '7500.3750');
      const sale = await request('/sales', employeeCookie, 'POST', payload);
      assert.equal(sale.status, 201); saleId = sale.body.saleId; assert.equal(sale.body.items.length, 2); assertNoCosts(sale.body);
      const retry = await request('/sales', employeeCookie, 'POST', payload);
      assert.equal(retry.body.saleId, saleId);
      assert.equal((await db.stockBatch.findUniqueOrThrow({ where: { batchId: validId } })).quantity, 18);
      assert.equal((await db.stockBatch.findUniqueOrThrow({ where: { batchId: nearId } })).quantity, 9);
      assert.equal((await request('/sales', employeeCookie, 'POST', { ...payload, items: [{ ...payload.items[0]!, quantity: 1 }] })).status, 409);
      assert.equal((await request(`/sales/${saleId}`, ownerCookie)).status, 200);
      assertNoCosts((await request('/sales', employeeCookie)).body);
    });
    await t.test('12: medicine edits never alter historical sale prices and stale quotes are rejected', async () => {
      const changed = await request(`/medicines/${medicineId}`, employeeCookie, 'PATCH', { name: `Acceptance ${marker}`, currentSellingPrice: '3000' });
      assert.equal(changed.status, 200);
      const history = await request(`/sales/${saleId}`, employeeCookie);
      assert.ok(new Prisma.Decimal(history.body.items[0].unitSellingPrice).equals('2500.1250'));
      assert.ok(new Prisma.Decimal(history.body.totalAmount).equals('7500.3750'));
      assert.equal((await request('/sales', employeeCookie, 'POST', confirm(validId, 1))).status, 409);
    });
    await t.test('13: owner reports reflect database values and dashboard counts are real', async () => {
      const report = await request('/reports/stock', ownerCookie);
      assert.equal(report.status, 200);
      assert.equal(report.body.batches.find((b: any) => b.batchId === validId).quantity, 18);
      const expiry = await request('/reports/expiry', ownerCookie);
      assert.ok(expiry.body.batches.some((b: any) => b.batchId === expiredId));
      const dashboard = await request('/dashboard', ownerCookie);
      assert.equal(dashboard.body.medicines, await db.medicine.count());
    });
    await t.test('concurrent sales cannot oversell the same batch', async () => {
      const batch = await db.stockBatch.create({ data: { medicineId, quantity: 5, expiryDate: new Date(date(60)), supplierPurchasePrice: '1' } });
      const payload = () => ({ requestKey: randomUUID(), items: [{ batchId: batch.batchId, quantity: 4, expectedUnitPrice: '3000' }] });
      const attempts = await Promise.all([request('/sales', employeeCookie, 'POST', payload()), request('/sales', employeeCookie, 'POST', payload())]);
      assert.equal(attempts.filter(result => result.status === 201).length, 1);
      assert.ok(attempts.some(result => [400, 409].includes(result.status)));
      assert.equal((await db.stockBatch.findUniqueOrThrow({ where: { batchId: batch.batchId } })).quantity, 1);
    });
    await t.test('one invalid item rolls back the whole sale and leaves stock unchanged', async () => {
      const before = (await db.stockBatch.findUniqueOrThrow({ where: { batchId: validId } })).quantity;
      const key = randomUUID();
      const result = await request('/sales', employeeCookie, 'POST', { requestKey: key, items: [
        { batchId: validId, quantity: 1, expectedUnitPrice: '3000' }, { batchId: expiredId, quantity: 1, expectedUnitPrice: '3000' },
      ] });
      assert.equal(result.status, 400);
      assert.equal((await db.stockBatch.findUniqueOrThrow({ where: { batchId: validId } })).quantity, before);
      assert.equal(await db.sale.count({ where: { requestKey: key } }), 0);
    });
    await t.test('a database insert failure after stock deduction rolls back every write', async () => {
      const before = (await db.stockBatch.findUniqueOrThrow({ where: { batchId: validId } })).quantity;
      const key = randomUUID();
      const constraint = `test_reject_${marker}`;
      // Controlled test-only DDL on the explicitly isolated *_test database.
      // A random UUID and alphanumeric identifier cannot introduce SQL input.
      await db.$executeRawUnsafe(`ALTER TABLE "sale" ADD CONSTRAINT "${constraint}" CHECK ("requestKey" <> '${key}'::uuid)`);
      try {
        const result = await request('/sales', employeeCookie, 'POST', { requestKey: key, items: [
          { batchId: validId, quantity: 1, expectedUnitPrice: '3000' },
        ] });
        assert.equal(result.status, 500);
        assert.equal((await db.stockBatch.findUniqueOrThrow({ where: { batchId: validId } })).quantity, before);
        assert.equal(await db.sale.count({ where: { requestKey: key } }), 0);
        assert.ok(!JSON.stringify(result.body).includes('postgresql'));
      } finally {
        await db.$executeRawUnsafe(`ALTER TABLE "sale" DROP CONSTRAINT "${constraint}"`);
      }
    });
    await t.test('logout revokes sessions; expired sessions cannot authenticate', async () => {
      await db.session.updateMany({ where: { userId: owner.userId }, data: { expiresAt: new Date(0) } });
      assert.equal((await request('/auth/me', ownerCookie)).status, 401);
      assert.equal((await request('/auth/logout', employeeCookie, 'POST', {})).status, 201);
      assert.equal((await request('/auth/me', employeeCookie)).status, 401);
    });
  } finally {
    // Keep isolated synthetic test records for inspection; never reset another database.
    await app.close(); await db.$disconnect();
  }
});
