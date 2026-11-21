import { Injectable } from '@nestjs/common';
import { APPLICATION_NAME, type HealthResponse } from '@pharmacy/shared';

@Injectable()
export class HealthService {
  getStatus(): HealthResponse {
    return { status: 'ok', application: APPLICATION_NAME };
  }
}
