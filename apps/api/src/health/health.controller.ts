import { Controller, Get, Inject } from '@nestjs/common';
import type { HealthResponse } from '@pharmacy/shared';
import { HealthService } from './health.service';
import { Public } from '../auth/access';

@Controller('health')
export class HealthController {
  // Explicit injection also works with the development runner, which does not emit metadata.
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  @Public()
  getStatus(): HealthResponse {
    return this.healthService.getStatus();
  }
}
