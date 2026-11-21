import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { Request, Response, NextFunction } from 'express';
import { ApiErrorFilter } from './common/errors';
import { settings } from './config/settings';

export async function createApplication() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (req.headers.origin && req.headers.origin !== settings().webOrigin) {
        res.status(403).json({ message: 'Request origin is not allowed.' }); return;
      }
      if (!req.headers['content-type']?.startsWith('application/json')) {
        res.status(415).json({ message: 'Use application/json for this operation.' }); return;
      }
    }
    next();
  });
  app.useGlobalFilters(new ApiErrorFilter());
  app.enableShutdownHooks();
  return app;
}
