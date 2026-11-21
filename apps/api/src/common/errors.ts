import { ArgumentsHost, Catch, HttpException, type ExceptionFilter } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    let status = 500;
    let message: string | string[] = 'The request could not be completed. Please try again.';
    if (error instanceof HttpException) {
      status = error.getStatus();
      const response = error.getResponse();
      message = typeof response === 'string' ? response : (response as { message: string | string[] }).message;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { status = 404; message = 'Record not found.'; }
      if (error.code === 'P2002') { status = 409; message = 'A record with that identifier already exists.'; }
      if (error.code === 'P2003') { status = 400; message = 'A referenced record does not exist.'; }
    }
    // Never serialize Prisma details, connection URLs, input values, or stack traces.
    if (status === 500) console.error('API request failed:', error instanceof Error ? error.name : 'UnknownError');
    host.switchToHttp().getResponse().status(status).json({ statusCode: status, message });
  }
}
