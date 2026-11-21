import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';
import { ExpiryChecker } from '../src/domain/expiry';

async function seed() {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true') throw new Error('Demo seeding is disabled.');
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.endsWith('_mvp')) throw new Error('Seed requires a local database whose name ends in _mvp.');
  const db = new PrismaClient();
  try {
    for (const role of ['OWNER', 'EMPLOYEE'] as const) {
      const username = process.env[`SEED_${role}_USERNAME`];
      const password = process.env[`SEED_${role}_PASSWORD`];
      if (!username || !/^[a-z0-9._-]{3,80}$/.test(username) || !password || password.length < 16 || password.length > 256) {
        throw new Error(`Set a lowercase SEED_${role}_USERNAME and a strong SEED_${role}_PASSWORD in the local environment.`);
      }
      const existing = await db.user.findUnique({ where: { username } });
      if (existing && existing.role !== role) throw new Error('Existing demo username has a different role; no account was changed.');
      if (!existing) await db.user.create({ data: { username, role, fullName: role === 'OWNER' ? 'Demo Pharmacy Owner' : 'Demo Pharmacy Employee', passwordHash: await hashPassword(password) } });
    }
    const today = new ExpiryChecker().today();
    const date = (days: number) => { const d = new Date(today); d.setUTCDate(d.getUTCDate() + days); return d; };
    const samples = [
      { name: 'Paracetamol 500 mg', brand: 'Demo Care', price: '1500', quantity: 80, days: 180 },
      { name: 'Amoxicillin 500 mg', brand: 'Demo Health', price: '4500', quantity: 36, days: 120 },
      { name: 'Cetirizine 10 mg', brand: 'Demo Care', price: '2500', quantity: 24, days: 12 },
      { name: 'Ibuprofen 200 mg', brand: 'Demo Health', price: '2000', quantity: 18, days: 25 },
      { name: 'Vitamin C 500 mg', brand: 'Demo Wellness', price: '3500', quantity: 40, days: 90 },
      { name: 'Omeprazole 20 mg', brand: 'Demo Care', price: '4000', quantity: 8, days: -5 },
    ];
    for (const [index, sample] of samples.entries()) {
      const barcode = `DEMO-${String(index + 1).padStart(4, '0')}`;
      if (await db.medicine.findFirst({ where: { barcode } })) continue;
      await db.medicine.create({ data: { name: sample.name, brand: sample.brand,
        description: 'Synthetic demonstration inventory. Not a real pharmacy record.', barcode,
        currentSellingPrice: sample.price, batches: { create: {
          quantity: sample.quantity, expiryDate: date(sample.days), supplierPurchasePrice: new Prisma.Decimal(sample.price).div(2),
        } } } });
    }
    // A second real batch demonstrates different acquisition costs and expiry dates.
    const medicine = await db.medicine.findFirst({ where: { barcode: 'DEMO-0001' }, select: { medicineId: true, _count: { select: { batches: true } } } });
    if (medicine?._count.batches === 1) await db.stockBatch.create({ data: {
      medicineId: medicine.medicineId, quantity: 30, expiryDate: date(60), supplierPurchasePrice: '800',
    } });
    console.log('Demo accounts and synthetic inventory are ready. Existing accounts, sales and quantities were preserved. Passwords are only in your ignored local environment.');
  } finally { await db.$disconnect(); }
}

void seed().catch(error => { console.error(error instanceof Error && !error.message.includes('postgresql:') ? error.message : 'Demo seed failed.'); process.exitCode = 1; });
