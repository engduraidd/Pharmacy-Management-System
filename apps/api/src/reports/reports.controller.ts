import { Controller, Get, Inject, Req } from '@nestjs/common';
import { OwnerOnly, type ActorRequest } from '../auth/access';
import { ReportsService } from './reports.service';

@Controller()
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}
  @Get('dashboard') dashboard(@Req() req: ActorRequest) { return this.reports.dashboard(req.actor); }
  @OwnerOnly() @Get('reports/stock') stock(@Req() req: ActorRequest) { return this.reports.stock(req.actor); }
  @OwnerOnly() @Get('reports/expiry') expiry(@Req() req: ActorRequest) { return this.reports.expiryReport(req.actor); }
}
