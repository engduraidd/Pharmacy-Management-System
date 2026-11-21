import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { PharmacyModule } from './pharmacy.module';

@Module({ imports: [DatabaseModule, AuthModule, HealthModule, PharmacyModule] })
export class AppModule {}
