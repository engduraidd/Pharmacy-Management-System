import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import type { ActorRequest } from '../auth/access';
import { InputPipe, previewInput, type PreviewInput, saleInput, type SaleInput } from '../common/validation';
import { SaleService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(@Inject(SaleService) private readonly sales: SaleService) {}
  @Get() list(@Req() req: ActorRequest) { return this.sales.list(req.actor); }
  @Get(':id') detail(@Req() req: ActorRequest, @Param('id', ParseIntPipe) id: number) { return this.sales.detail(req.actor, id); }
  @Post('preview') preview(@Body(new InputPipe(previewInput)) input: PreviewInput) { return this.sales.preview(input); }
  @Post() create(@Req() req: ActorRequest, @Body(new InputPipe(saleInput)) input: SaleInput) { return this.sales.create(req.actor, input); }
}
