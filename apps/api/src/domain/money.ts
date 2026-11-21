import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function checkedMoney(value: Prisma.Decimal): Prisma.Decimal {
  if (!value.isFinite() || value.isNegative() || value.greaterThan('99999999999999.9999')) {
    throw new BadRequestException('Amount is outside the supported range.');
  }
  return value;
}

export function lineTotal(price: Prisma.Decimal, quantity: number): Prisma.Decimal {
  return checkedMoney(price.mul(quantity));
}
