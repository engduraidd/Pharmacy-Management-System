import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '@prisma/client';
import { ExpiryChecker, isCalendarDate } from '../src/domain/expiry';
import { checkedMoney, lineTotal } from '../src/domain/money';
import { hashPassword, verifyPassword } from '../src/auth/password';
import { groupItems } from '../src/sales/sales.service';
import { randomBytes } from 'node:crypto';

test('expiry uses the pharmacy calendar and blocks the expiry date itself', () => {
  const originalZone = process.env.APP_TIME_ZONE;
  const originalDays = process.env.EXPIRY_ALERT_DAYS;
  try {
    process.env.APP_TIME_ZONE = 'Asia/Baghdad'; process.env.EXPIRY_ALERT_DAYS = '30';
    const policy = new ExpiryChecker();
    const now = new Date('2026-11-13T22:00:00Z'); // Already November 14 in Baghdad.
    assert.equal(policy.today(now).toISOString().slice(0, 10), '2026-11-14');
    assert.equal(policy.status(new Date('2026-11-14'), now), 'EXPIRED');
    assert.equal(policy.status(new Date('2026-12-14'), now), 'EXPIRING');
    assert.equal(policy.status(new Date('2026-12-15'), now), 'VALID');
    assert.equal(isCalendarDate('2026-02-30'), false);
    assert.equal(isCalendarDate('2028-02-29'), true);
  } finally {
    if (originalZone === undefined) delete process.env.APP_TIME_ZONE; else process.env.APP_TIME_ZONE = originalZone;
    if (originalDays === undefined) delete process.env.EXPIRY_ALERT_DAYS; else process.env.EXPIRY_ALERT_DAYS = originalDays;
  }
});

test('money arithmetic is exact and rejects numeric overflow/nonfinite values', () => {
  assert.equal(lineTotal(new Prisma.Decimal('0.1'), 3).toFixed(4), '0.3000');
  assert.throws(() => checkedMoney(new Prisma.Decimal('NaN')));
  assert.throws(() => lineTotal(new Prisma.Decimal('99999999999999.9999'), 2));
});

test('duplicate batch lines cannot bypass combined quantity validation', () => {
  assert.deepEqual(groupItems([{ batchId: 1, quantity: 3 }, { batchId: 1, quantity: 4 }]), [{ batchId: 1, quantity: 7 }]);
  assert.throws(() => groupItems([{ batchId: 1, quantity: 1_000_000 }, { batchId: 1, quantity: 1 }]));
});

test('password hashes have random salts and verify without storing plaintext', async () => {
  const password = randomBytes(24).toString('hex');
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword(randomBytes(24).toString('hex'), first), false);
});
