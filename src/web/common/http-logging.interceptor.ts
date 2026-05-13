import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const started = Date.now();
    const method = req.method;
    const path = req.originalUrl ?? req.url ?? '';

    return next.handle().pipe(
      catchError((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`${method} ${path} → exception: ${message}`);
        return throwError(() => err);
      }),
      finalize(() => {
        const ms = Date.now() - started;
        this.logger.log(`${method} ${path} ${res.statusCode} ${ms}ms`);
      }),
    );
  }
}
