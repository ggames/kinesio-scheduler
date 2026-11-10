import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { normalizeEmail } from '../utils/email.util';
import { RATE_LIMIT_KEY } from './rate-limit.decorator';
import type { RateLimitOptions } from './rate-limit.decorator';
import { DistributedRateLimitService } from './distributed-rate-limit.service';

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private readonly globalLimit: number;
  private readonly globalTtlMs: number;
  private readonly store: string;
  private operations = 0;

  constructor(
    private readonly reflector: Reflector,
    configService: ConfigService,
    @Optional()
    private readonly distributedStore?: DistributedRateLimitService,
  ) {
    this.globalLimit = this.numberConfig(
      configService.get<string>('THROTTLE_LIMIT'),
      100,
    );
    this.globalTtlMs = this.numberConfig(
      configService.get<string>('THROTTLE_TTL_MS'),
      60_000,
    );
    this.store = configService.get<string>('RATE_LIMIT_STORE') ?? 'memory';
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const options =
      this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? { limit: this.globalLimit, ttlMs: this.globalTtlMs };

    const request = context.switchToHttp().getRequest<Record<string, any>>();
    const response = context.switchToHttp().getResponse<Record<string, any>>();
    const ip = request.ip ?? request.ips?.[0] ?? 'unknown';
    const email = normalizeEmail(request.body?.email);
    const route = request.route?.path ?? request.path ?? 'unknown';
    const key = `${request.method}:${route}:${ip}:${email}`;
    const now = Date.now();

    if (this.store === 'postgres' && this.distributedStore) {
      return this.consumeDistributed(key, options, response);
    }

    this.cleanup(now);

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + options.ttlMs });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > options.limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      response.setHeader?.('Retry-After', String(retryAfter));
      throw new HttpException(
        'Demasiadas solicitudes. Intentá nuevamente más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private async consumeDistributed(
    key: string,
    options: RateLimitOptions,
    response: Record<string, any>,
  ): Promise<boolean> {
    const result = await this.distributedStore!.consume(
      key,
      options.ttlMs,
      options.limit,
    );
    if (!result.allowed) {
      response.setHeader?.('Retry-After', String(result.retryAfter));
      throw new HttpException(
        'Demasiadas solicitudes. Intentá nuevamente más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private cleanup(now: number): void {
    this.operations += 1;
    if (this.operations % 1000 !== 0 && this.buckets.size < 10_000) {
      return;
    }

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }

  private numberConfig(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
