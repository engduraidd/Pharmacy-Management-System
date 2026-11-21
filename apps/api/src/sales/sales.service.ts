import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.module';
import { ExpiryChecker } from '../domain/expiry';
import { checkedMoney, lineTotal } from '../domain/money';
import type { Actor } from '../auth/access';
import type { PreviewInput, SaleInput } from '../common/validation';
import { publicBatchSelect } from '../inventory/inventory.service';

const saleSelect = {
  saleId: true, userId: true, dateTime: true, totalAmount: true,
  user: { select: { fullName: true } },
  items: { select: { saleItemId: true, batchId: true, quantity: true, unitSellingPrice: true, subtotal: true,
    batch: { select: { medicine: { select: { name: true, brand: true } } } } } },
} as const;

export function groupItems(items: PreviewInput['items']) {
  const grouped = new Map<number, PreviewInput['items'][number]>();
  for (const item of items) {
    const prior = grouped.get(item.batchId);
    if (prior) {
      if (prior.expectedUnitPrice !== item.expectedUnitPrice) throw new BadRequestException('Conflicting prices for the same batch.');
      prior.quantity += item.quantity;
      if (prior.quantity > 1_000_000) throw new BadRequestException('Combined quantity exceeds the supported limit.');
    } else grouped.set(item.batchId, { ...item });
  }
  return [...grouped.values()].sort((a, b) => a.batchId - b.batchId);
}

@Injectable()
export class SaleService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ExpiryChecker) private readonly expiry: ExpiryChecker) {}

  private async quote(tx: Prisma.TransactionClient, items: PreviewInput['items']) {
    const today = this.expiry.today();
    const quoted = [];
    for (const item of groupItems(items)) {
      const batch = await tx.stockBatch.findUnique({ where: { batchId: item.batchId }, select: publicBatchSelect });
      if (!batch) throw new NotFoundException('Selected batch does not exist.');
      if (batch.expiryDate <= today) throw new BadRequestException('Expired batches cannot be sold.');
      if (batch.quantity < item.quantity) throw new BadRequestException('Insufficient stock in the selected batch.');
      const price = batch.medicine.currentSellingPrice;
      if (item.expectedUnitPrice !== undefined && !price.equals(item.expectedUnitPrice)) {
        throw new ConflictException('The selling price changed. Review the sale again.');
      }
      quoted.push({ batchId: batch.batchId, medicineId: batch.medicineId, name: batch.medicine.name,
        quantity: item.quantity, unitSellingPrice: price.toFixed(4), subtotal: lineTotal(price, item.quantity).toFixed(4) });
    }
    const total = checkedMoney(quoted.reduce((sum, item) => sum.plus(item.subtotal), new Prisma.Decimal(0)));
    return { items: quoted, totalAmount: total.toFixed(4) };
  }

  preview(input: PreviewInput) { return this.db.$transaction(tx => this.quote(tx, input.items)); }

  async create(actor: Actor, input: SaleInput) {
    const grouped = groupItems(input.items);
    const fingerprint = createHash('sha256').update(JSON.stringify(grouped.map(item => ({
      batchId: item.batchId, quantity: item.quantity, expectedUnitPrice: new Prisma.Decimal(item.expectedUnitPrice!).toFixed(4),
    })))).digest('hex');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const prior = await this.db.sale.findUnique({ where: { requestKey: input.requestKey }, select: { saleId: true, userId: true, requestHash: true } });
        if (prior) {
          if (prior.userId !== actor.userId || prior.requestHash !== fingerprint) throw new ConflictException('This request identifier was already used.');
          return this.detail(actor, prior.saleId);
        }
        return await this.db.$transaction(async tx => {
          const quote = await this.quote(tx, grouped);
          const today = this.expiry.today();
          for (const item of quote.items) {
            const changed = await tx.stockBatch.updateMany({
              where: { batchId: item.batchId, quantity: { gte: item.quantity }, expiryDate: { gt: today } },
              data: { quantity: { decrement: item.quantity } },
            });
            if (changed.count !== 1) throw new ConflictException('Stock changed. Review the sale again.');
          }
          return tx.sale.create({ data: {
            userId: actor.userId, requestKey: input.requestKey, requestHash: fingerprint, totalAmount: quote.totalAmount,
            items: { create: quote.items.map(item => ({ batchId: item.batchId, quantity: item.quantity,
              unitSellingPrice: item.unitSellingPrice, subtotal: item.subtotal })) },
          }, select: saleSelect });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code) && attempt < 2) continue;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ConflictException('Stock is busy. Review and retry this sale.');
        throw error;
      }
    }
    throw new ConflictException('The sale could not be confirmed.');
  }

  list(actor: Actor) {
    return this.db.sale.findMany({ where: actor.role === 'OWNER' ? {} : { userId: actor.userId },
      select: saleSelect, orderBy: { saleId: 'desc' }, take: 100 });
  }
  async detail(actor: Actor, saleId: number) {
    const sale = await this.db.sale.findFirst({ where: { saleId, ...(actor.role === 'OWNER' ? {} : { userId: actor.userId }) }, select: saleSelect });
    if (!sale) throw new NotFoundException('Sale not found.');
    return sale;
  }
}
