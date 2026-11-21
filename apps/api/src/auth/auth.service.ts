import { createHash, randomBytes } from 'node:crypto';
import { HttpException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.module';
import { verifyPassword } from './password';

export const profileSelect = { userId: true, username: true, fullName: true, role: true } as const;

@Injectable()
export class AuthenticationService {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async login(username: string, password: string, ip: string) {
    const key = `${ip}:${username.toLowerCase()}`;
    const now = Date.now();
    for (const [entry, value] of this.attempts) if (value.until < now) this.attempts.delete(entry);
    const limit = this.attempts.get(key) ?? { count: 0, until: now + 15 * 60_000 };
    if (limit.count >= 10 || this.attempts.size > 5000) throw new HttpException('Too many login attempts. Try again later.', 429);
    limit.count += 1;
    this.attempts.set(key, limit);
    const user = await this.db.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) throw new UnauthorizedException('Incorrect username or password.');
    this.attempts.delete(key);
    const token = randomBytes(32).toString('hex');
    await this.db.session.create({ data: {
      userId: user.userId, tokenHash: this.digest(token), expiresAt: new Date(now + 8 * 60 * 60_000),
    } });
    return { token, user: { userId: user.userId, fullName: user.fullName, username: user.username, role: user.role } };
  }

  digest(token: string) { return createHash('sha256').update(token).digest('hex'); }

  async authenticate(token: string) {
    const session = await this.db.session.findUnique({ where: { tokenHash: this.digest(token) }, select: {
      tokenHash: true, expiresAt: true, user: { select: profileSelect },
    } });
    if (!session || session.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return session;
  }

  async logout(tokenHash: string) { await this.db.session.deleteMany({ where: { tokenHash } }); }
}
