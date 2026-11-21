import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { type ActorRequest, OwnerOnly } from '../auth/access';
import { batchInput, type BatchInput, InputPipe, purchasePriceInput } from '../common/validation';
import { InventoryService } from './inventory.service';

@Controller()
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly inventory: InventoryService) {}
  @Get('batches') list(@Req() req: ActorRequest, @Query('medicineId', new ParseIntPipe({ optional: true })) id?: number) { return this.inventory.list(req.actor, id); }
  @Post('batches') create(@Req() req: ActorRequest, @Body(new InputPipe(batchInput)) input: BatchInput) { return this.inventory.create(req.actor, input); }
  @Get('expiry-alerts') alerts(@Req() req: ActorRequest) { return this.inventory.alerts(req.actor); }
  @OwnerOnly() @Get('batches/:id/purchase-price') price(@Param('id', ParseIntPipe) id: number) { return this.inventory.purchasePrice(id); }
  @OwnerOnly() @Patch('batches/:id/purchase-price') setPrice(@Param('id', ParseIntPipe) id: number,
    @Body(new InputPipe(purchasePriceInput)) input: { supplierPurchasePrice: string }) { return this.inventory.setPurchasePrice(id, input.supplierPurchasePrice); }
}
