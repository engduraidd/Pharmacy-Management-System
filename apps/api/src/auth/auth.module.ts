import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SessionGuard } from './access';
import { AuthController } from './auth.controller';
import { AuthenticationService } from './auth.service';

@Module({ controllers: [AuthController], providers: [AuthenticationService, { provide: APP_GUARD, useClass: SessionGuard }] })
export class AuthModule {}
