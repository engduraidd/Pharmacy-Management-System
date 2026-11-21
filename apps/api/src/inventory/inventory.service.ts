import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.module';
import { ExpiryChecker } from '../domain/expiry';
import type { Actor } from '../auth/access';
import type { BatchInput } from '../common/validation';
import { medicineSelect } from '../medicines/medicines.service';

// Employee paths never select supplierPurchasePrice, including nested relations.
export const publicBatchSelect = {
  batchId: true, medicineId: true, quantity: true, expiryDate: true,
  medicine: { select: medicineSelect },
} as const;

@Injectable()
export class InventoryService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ExpiryChecker) private readonly expiry: ExpiryChecker) {}

  async list(actor: Actor, medicineId?: number) {
    const batches = await this.db.stockBatch.findMany({
      where: medicineId ? { medicineId } : {},
      select: { ...publicBatchSelect, ...(actor.role === 'OWNER' ? { supplierPurchasePrice: true } : {}) },
      orderBy: [{ expiryDate: 'asc' }, { batchId: 'asc' }],
    });
    return batches.map(batch => ({ ...batch, status: this.expiry.status(batch.expiryDate) }));
  }

  async create(actor: Actor, input: BatchInput) {
    if (actor.role !== 'OWNER' && input.supplierPurchasePrice !== undefined) throw new ForbiddenException('Only the owner may record purchase prices.');
    if (actor.role === 'OWNER' && input.supplierPurchasePrice === undefined) throw new BadRequestException('Purchase price is required when the owner adds a batch.');
    return this.db.stockBatch.create({ data: { ...input, expiryDate: new Date(`${input.expiryDate}T00:00:00.000Z`) },
      select: { ...publicBatchSelect, ...(actor.role === 'OWNER' ? { supplierPurchasePrice: true } : {}) } });
  }

  async purchasePrice(batchId: number) {
    const record = await this.db.stockBatch.findUnique({ where: { batchId }, select: { batchId: true, supplierPurchasePrice: true } });
    if (!record) throw new NotFoundException('Batch not found.');
    return record;
  }

  setPurchasePrice(batchId: number, supplierPurchasePrice: string) {
    return this.db.stockBatch.update({ where: { batchId }, data: { supplierPurchasePrice }, select: { batchId: true, supplierPurchasePrice: true } });
  }

  async alerts(actor: Actor) { return (await this.list(actor)).filter(batch => batch.quantity > 0 && batch.status !== 'VALID'); }
}
