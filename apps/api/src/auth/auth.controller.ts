import { Body, Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { InputPipe, loginInput } from '../common/validation';
import { settings } from '../config/settings';
import { Public, type ActorRequest } from './access';
import { AuthenticationService } from './auth.service';

const cookieOptions = () => ({ httpOnly: true, sameSite: 'strict' as const, secure: process.env.NODE_ENV === 'production', path: '/' });

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthenticationService) private readonly auth: AuthenticationService) {}

  @Public()
  @Post('login')
  async login(@Body(new InputPipe(loginInput)) input: { username: string; password: string },
    @Req() request: ActorRequest, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(input.username, input.password, request.ip ?? 'local');
    response.cookie('pharmacy_session', result.token, { ...cookieOptions(), maxAge: 8 * 60 * 60_000 });
    return { user: result.user, settings: settings() };
  }

  @Get('me')
  me(@Req() request: ActorRequest) { return { user: request.actor, settings: settings() }; }

  @Post('logout')
  async logout(@Req() request: ActorRequest, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.sessionHash);
    response.clearCookie('pharmacy_session', cookieOptions());
    return { message: 'Signed out.' };
  }
}
