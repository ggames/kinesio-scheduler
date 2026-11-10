import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

/**
 * Atomic fixed-window counter in PostgreSQL. Used when RATE_LIMIT_STORE=postgres
 * so multiple replicas share the same limits.
 */
@Injectable()
export class DistributedRateLimitService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async consume(
    key: string,
    windowMs: number,
    limit: number,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const resetAt = new Date(now + windowMs);

    const rows: { count: number | string; resetAt: string | Date }[] =
      await this.dataSource.query(
        `INSERT INTO "rate_limit_buckets" ("key", "count", "resetAt", "updatedAt")
         VALUES ($1, 1, $2, now())
         ON CONFLICT ("key") DO UPDATE
           SET "count" = CASE
                 WHEN "rate_limit_buckets"."resetAt" <= now() THEN 1
                 ELSE "rate_limit_buckets"."count" + 1
               END,
               "resetAt" = CASE
                 WHEN "rate_limit_buckets"."resetAt" <= now() THEN $2
                 ELSE "rate_limit_buckets"."resetAt"
               END,
               "updatedAt" = now()
         RETURNING "count", "resetAt"`,
        [key, resetAt],
      );

    const count = Number(rows[0]?.count ?? 1);
    const resetTime = new Date(rows[0]?.resetAt ?? resetAt).getTime();
    return {
      allowed: count <= limit,
      retryAfter: Math.max(1, Math.ceil((resetTime - now) / 1000)),
    };
  }
}
