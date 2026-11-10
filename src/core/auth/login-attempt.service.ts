import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { LoginAttempt } from './domain/login-attempt.entity';
import { normalizeEmail } from '../utils/email.util';

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_WINDOW_MINUTES = 15;
const DEFAULT_LOCK_MINUTES = 15;
const CLEANUP_AFTER_DAYS = 30;

@Injectable()
export class LoginAttemptService {
  private readonly logger = new Logger(LoginAttemptService.name);

  constructor(
    @InjectRepository(LoginAttempt)
    private readonly loginAttemptRepository: Repository<LoginAttempt>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async assertNotLocked(email: string): Promise<void> {
    const emailHash = this.hashEmail(email);
    const attempt = await this.loginAttemptRepository.findOne({
      where: { emailHash },
    });

    if (attempt?.lockedUntil && attempt.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
  }

  async recordFailure(email: string): Promise<void> {
    const emailHash = this.hashEmail(email);
    const maxAttempts = this.numberConfig(
      'LOGIN_MAX_ATTEMPTS',
      DEFAULT_MAX_ATTEMPTS,
    );
    const windowMinutes = this.numberConfig(
      'LOGIN_WINDOW_MINUTES',
      DEFAULT_WINDOW_MINUTES,
    );
    const lockMinutes = this.numberConfig(
      'LOGIN_LOCK_MINUTES',
      DEFAULT_LOCK_MINUTES,
    );

    await this.dataSource.query(
      `INSERT INTO "login_attempts"
         ("emailHash", "failedAttempts", "firstFailedAt", "updatedAt")
       VALUES ($1, 1, now(), now())
       ON CONFLICT ("emailHash") DO UPDATE SET
         "failedAttempts" = CASE
           WHEN login_attempts."firstFailedAt" IS NULL
             OR login_attempts."firstFailedAt" < now() - ($2 || ' minutes')::interval
           THEN 1
           ELSE login_attempts."failedAttempts" + 1
         END,
         "firstFailedAt" = CASE
           WHEN login_attempts."firstFailedAt" IS NULL
             OR login_attempts."firstFailedAt" < now() - ($2 || ' minutes')::interval
           THEN now()
           ELSE login_attempts."firstFailedAt"
         END,
         "lockedUntil" = CASE
           WHEN (
             CASE
               WHEN login_attempts."firstFailedAt" IS NULL
                 OR login_attempts."firstFailedAt" < now() - ($2 || ' minutes')::interval
               THEN 1
               ELSE login_attempts."failedAttempts" + 1
             END
           ) >= $3
           THEN now() + ($4 || ' minutes')::interval
           ELSE login_attempts."lockedUntil"
         END,
         "updatedAt" = now()`,
      [emailHash, windowMinutes, maxAttempts, lockMinutes],
    );
  }

  async clearFailures(email: string): Promise<void> {
    await this.loginAttemptRepository.delete({ emailHash: this.hashEmail(email) });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldAttempts(): Promise<void> {
    const cutoff = new Date(
      Date.now() - CLEANUP_AFTER_DAYS * 24 * 60 * 60 * 1000,
    );
    const result = await this.loginAttemptRepository.delete({
      updatedAt: LessThan(cutoff),
    });
    this.logger.log(`Intentos de login antiguos eliminados: ${result.affected ?? 0}`);
  }

  private hashEmail(email: string): string {
    return this.hashValue(normalizeEmail(email));
  }

  private hashValue(value: string): string {
    const secret =
      this.configService.get<string>('LOGIN_ATTEMPT_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'login-attempt-secret';
    return crypto.createHmac('sha256', secret).update(value).digest('hex');
  }

  private numberConfig(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
