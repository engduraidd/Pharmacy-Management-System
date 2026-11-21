import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { InputPipe, medicineInput, type MedicineInput } from '../common/validation';
import { MedicinesService } from './medicines.service';

@Controller('medicines')
export class MedicinesController {
  constructor(@Inject(MedicinesService) private readonly medicines: MedicinesService) {}
  @Get() list(@Query('search') search?: string) { return this.medicines.list(search); }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) { return this.medicines.detail(id); }
  @Post() create(@Body(new InputPipe(medicineInput)) input: MedicineInput) { return this.medicines.create(input); }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body(new InputPipe(medicineInput)) input: MedicineInput) { return this.medicines.update(id, input); }
}
