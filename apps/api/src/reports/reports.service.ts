import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.module';
import type { Actor } from '../auth/access';
import { InventoryService } from '../inventory/inventory.service';
import { ExpiryChecker } from '../domain/expiry';
import { settings } from '../config/settings';

@Injectable()
export class ReportsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
    @Inject(ExpiryChecker) private readonly expiry: ExpiryChecker) {}

  async stock(actor: Actor) { return { generatedAt: new Date().toISOString(), batches: await this.inventory.list(actor) }; }
  async expiryReport(actor: Actor) { return { generatedAt: new Date().toISOString(), alertDays: settings().expiryAlertDays, batches: await this.inventory.alerts(actor) }; }

  async dashboard(actor: Actor) {
    const today = this.expiry.today();
    const [medicines, stock, expiredBatches, expiringBatches, sales, recentSales] = await this.db.$transaction([
      this.db.medicine.count(), this.db.stockBatch.aggregate({ _sum: { quantity: true } }),
      this.db.stockBatch.count({ where: { quantity: { gt: 0 }, expiryDate: { lte: today } } }),
      this.db.stockBatch.count({ where: { quantity: { gt: 0 }, expiryDate: { gt: today, lte: this.expiry.threshold() } } }),
      this.db.sale.count({ where: actor.role === 'OWNER' ? {} : { userId: actor.userId } }),
      this.db.sale.findMany({ where: actor.role === 'OWNER' ? {} : { userId: actor.userId },
        select: { saleId: true, dateTime: true, totalAmount: true, user: { select: { fullName: true } }, _count: { select: { items: true } } },
        orderBy: { saleId: 'desc' }, take: 5 }),
    ]);
    return { medicines, unitsOnHand: stock._sum.quantity ?? 0, expiredBatches, expiringBatches, sales, recentSales };
  }
}
