import { Module } from '@nestjs/common';
import { ExpiryChecker } from './domain/expiry';
import { MedicinesController } from './medicines/medicines.controller';
import { MedicinesService } from './medicines/medicines.service';
import { InventoryController } from './inventory/inventory.controller';
import { InventoryService } from './inventory/inventory.service';
import { SalesController } from './sales/sales.controller';
import { SaleService } from './sales/sales.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';

@Module({ controllers: [MedicinesController, InventoryController, SalesController, ReportsController],
  providers: [MedicinesService, InventoryService, SaleService, ReportsService, ExpiryChecker] })
export class PharmacyModule {}
