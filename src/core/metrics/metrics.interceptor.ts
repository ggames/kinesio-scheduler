import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      finalize(() => {
        const seconds = Number(process.hrtime.bigint() - start) / 1e9;
        const route =
          request.route?.path !== undefined
            ? `${request.baseUrl ?? ''}${request.route.path}`
            : request.path ?? 'unknown';
        const labels = {
          method: request.method,
          route,
          status: response.statusCode ?? 200,
        };

        this.metrics.increment('http_requests_total', labels);
        this.metrics.observe('http_request_duration_seconds', labels, seconds);
      }),
    );
  }
}
