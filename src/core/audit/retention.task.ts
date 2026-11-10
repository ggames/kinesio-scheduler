import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CronLockService } from '../scheduling/cron-lock.service';

/**
 * Daily retention job for operational data.
 * Runs under a Postgres advisory-style lock so replicas do not double-delete.
 */
@Injectable()
export class RetentionTask {
  private readonly logger = new Logger(RetentionTask.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly cronLock: CronLockService,
  ) {}

  @Cron('0 4 * * *')
  async purgeExpiredData(): Promise<void> {
    await this.cronLock.runWithLock('retention.purge', 30 * 60 * 1000, async () => {
      const auditDays = this.nonNegativeInt('AUDIT_RETENTION_DAYS', 365);
      const loginDays = this.nonNegativeInt('LOGIN_ATTEMPT_RETENTION_DAYS', 30);
      const outboxDays = this.nonNegativeInt('OUTBOX_RETENTION_DAYS', 90);

      const auditResult = await this.dataSource.query(
        `DELETE FROM "audit_logs" WHERE "createdAt" < now() - ($1 || ' days')::interval`,
        [auditDays],
      );
      const loginResult = await this.dataSource.query(
        `DELETE FROM "login_attempts" WHERE "updatedAt" < now() - ($1 || ' days')::interval`,
        [loginDays],
      );
      const outboxResult = await this.dataSource.query(
        `DELETE FROM "email_outbox" WHERE "status" = 'SENT' AND "sentAt" < now() - ($1 || ' days')::interval`,
        [outboxDays],
      );
      const idempotencyResult = await this.dataSource.query(
        `DELETE FROM "idempotency_keys" WHERE "expiresAt" < now()`,
      );
      const rateLimitResult = await this.dataSource.query(
        `DELETE FROM "rate_limit_buckets" WHERE "resetAt" < now() - interval '1 hour'`,
      );
      await this.dataSource.query(
        `DELETE FROM "cron_locks" WHERE "lockedUntil" < now() - interval '1 day'`,
      );

      this.logger.log(
        `Retención: audit=${auditResult?.[1] ?? 0}, loginAttempts=${loginResult?.[1] ?? 0}, outbox=${outboxResult?.[1] ?? 0}, idempotency=${idempotencyResult?.[1] ?? 0}, rateLimit=${rateLimitResult?.[1] ?? 0}`,
      );
    });
  }

  private nonNegativeInt(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key));
    return Number.isInteger(value) && value >= 0 ? value : fallback;
  }
}
