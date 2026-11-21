import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '@prisma/client';
import { AuthenticationService } from './auth.service';

export type Actor = { userId: number; username: string; fullName: string; role: UserRole };
export type ActorRequest = Request & { actor: Actor; sessionHash: string };
export const Public = () => SetMetadata('public', true);
export const OwnerOnly = () => SetMetadata('ownerOnly', true);

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthenticationService) private readonly auth: AuthenticationService,
    @Inject(Reflector) private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride('public', [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<ActorRequest>();
    const token = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('pharmacy_session='))?.slice(17);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new UnauthorizedException('Please sign in.');
    const session = await this.auth.authenticate(token);
    request.actor = session.user;
    request.sessionHash = session.tokenHash;
    if (this.reflector.getAllAndOverride('ownerOnly', [context.getHandler(), context.getClass()]) && request.actor.role !== 'OWNER') {
      throw new ForbiddenException('This operation is available to the owner only.');
    }
    return true;
  }
}
