import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { isCalendarDate } from '../domain/expiry';

@Injectable()
export class InputPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodType) {}
  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const paths = [...new Set(result.error.issues.map(issue => issue.path.join('.') || 'request'))];
      throw new BadRequestException(`Invalid input: ${paths.join(', ')}. Check required fields and value formats.`);
    }
    return result.data;
  }
}

export const moneyInput = z.string().regex(/^(0|[1-9]\d{0,13})(\.\d{1,4})?$/);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
export const medicineInput = z.strictObject({
  name: z.string().trim().min(2).max(160), brand: optionalText(120),
  description: optionalText(2000), barcode: optionalText(80), currentSellingPrice: moneyInput,
});
export type MedicineInput = z.infer<typeof medicineInput>;
export const batchInput = z.strictObject({
  medicineId: z.number().int().positive(), quantity: z.number().int().min(1).max(1_000_000),
  expiryDate: z.string().refine(isCalendarDate), supplierPurchasePrice: moneyInput.optional(),
});
export type BatchInput = z.infer<typeof batchInput>;
export const purchasePriceInput = z.strictObject({ supplierPurchasePrice: moneyInput });
export const loginInput = z.strictObject({
  username: z.string().trim().min(1).max(80), password: z.string().min(1).max(256),
});
const itemInput = z.strictObject({
  batchId: z.number().int().positive(), quantity: z.number().int().min(1).max(1_000_000),
  expectedUnitPrice: moneyInput.optional(),
});
export const previewInput = z.strictObject({ items: z.array(itemInput).min(1).max(30) });
export const saleInput = z.strictObject({
  items: z.array(itemInput.extend({ expectedUnitPrice: moneyInput })).min(1).max(30),
  requestKey: z.uuid(),
});
export type PreviewInput = z.infer<typeof previewInput>;
export type SaleInput = z.infer<typeof saleInput>;
