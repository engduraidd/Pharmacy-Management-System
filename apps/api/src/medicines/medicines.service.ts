import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.module';
import type { MedicineInput } from '../common/validation';

export const medicineSelect = { medicineId: true, name: true, brand: true, description: true, barcode: true, currentSellingPrice: true } as const;

@Injectable()
export class MedicinesService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  list(search = '') {
    if (typeof search !== 'string' || search.length > 100) throw new BadRequestException('Search must be at most 100 characters.');
    return this.db.medicine.findMany({ where: search ? { OR: [
      { name: { contains: search, mode: 'insensitive' } }, { brand: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
    ] } : {}, select: medicineSelect, orderBy: { name: 'asc' } });
  }
  async detail(medicineId: number) {
    const medicine = await this.db.medicine.findUnique({ where: { medicineId }, select: medicineSelect });
    if (!medicine) throw new NotFoundException('Medicine not found.');
    return medicine;
  }
  create(input: MedicineInput) { return this.db.medicine.create({ data: input, select: medicineSelect }); }
  update(medicineId: number, input: MedicineInput) { return this.db.medicine.update({ where: { medicineId }, data: input, select: medicineSelect }); }
}
