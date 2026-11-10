import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmailOutboxStatus } from './domain/email-outbox.entity';
import { MAIL_PROVIDER } from './mail.types';
import type { MailProvider } from './mail.types';
import { TokenCipher } from './token-cipher';
import { renderActivationEmail } from './templates/activation.template';
import { renderAppointmentEmail } from './templates/appointment.template';
import { renderResetPasswordEmail } from './templates/reset-password.template';
import { renderWelcomeEmail } from './templates/welcome.template';

interface ClaimedEmail {
  id: string;
  to: string;
  template: string;
  payload: {
    firstName?: string;
    encryptedActivationUrl?: string;
    encryptedResetUrl?: string;
    date?: string;
    time?: string;
    professionalName?: string;
    reason?: string;
  };
  attempts: number | string;
}

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);
  private processing = false;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(MAIL_PROVIDER)
    private readonly mailProvider: MailProvider,
    private readonly tokenCipher: TokenCipher,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processPending(): Promise<void> {
    if (this.processing || !this.mailProvider.isEnabled()) {
      return;
    }

    this.processing = true;
    try {
      await this.recoverStaleClaims();
      const batch = await this.claimBatch(10);

      for (const email of batch) {
        await this.sendEmail(email);
      }
    } catch (error) {
      this.logger.error(
        `Error procesando outbox de emails: ${this.errorMessage(error)}`,
      );
    } finally {
      this.processing = false;
    }
  }

  private async recoverStaleClaims(): Promise<void> {
    await this.dataSource.query(
      `UPDATE "email_outbox"
       SET "status" = $1, "updatedAt" = now()
       WHERE "status" = $2
         AND "updatedAt" < now() - interval '10 minutes'`,
      [EmailOutboxStatus.PENDING, EmailOutboxStatus.SENDING],
    );
  }

  private async claimBatch(limit: number): Promise<ClaimedEmail[]> {
    return this.dataSource.query(
      `UPDATE "email_outbox"
       SET "status" = $1, "updatedAt" = now()
       WHERE "id" IN (
         SELECT "id"
         FROM "email_outbox"
         WHERE "status" = $2
           AND "nextAttemptAt" <= now()
         ORDER BY "nextAttemptAt" ASC
         LIMIT $3
         FOR UPDATE SKIP LOCKED
       )
       RETURNING "id", "to", "template", "payload", "attempts"`,
      [EmailOutboxStatus.SENDING, EmailOutboxStatus.PENDING, limit],
    );
  }

  private async sendEmail(email: ClaimedEmail): Promise<void> {
    try {
      const message = this.renderMessage(email);

      await this.mailProvider.send(message);
      await this.markSent(email.id);
    } catch (error) {
      await this.markFailed(email, error);
    }
  }

  private renderMessage(email: ClaimedEmail) {
    if (email.template === 'activation') {
      const encryptedUrl = email.payload?.encryptedActivationUrl;
      if (!encryptedUrl) {
        throw new Error('Payload de activación inválido');
      }

      const activationUrl = this.tokenCipher.decrypt(encryptedUrl);
      return renderActivationEmail(
        email.to,
        email.payload.firstName ?? '',
        activationUrl,
      );
    }

    if (email.template === 'reset-password') {
      const encryptedUrl = email.payload?.encryptedResetUrl;
      if (!encryptedUrl) {
        throw new Error('Payload de restablecimiento inválido');
      }

      const resetUrl = this.tokenCipher.decrypt(encryptedUrl);
      return renderResetPasswordEmail(
        email.to,
        email.payload.firstName ?? '',
        resetUrl,
      );
    }

    if (email.template === 'welcome') {
      return renderWelcomeEmail(
        email.to,
        email.payload.firstName ?? '',
      );
    }

    if (email.template.startsWith('appointment_')) {
      return renderAppointmentEmail(
        email.template as
          | 'appointment_confirmed'
          | 'appointment_cancelled'
          | 'appointment_rescheduled'
          | 'appointment_reminder',
        email.to,
        email.payload,
      );
    }

    throw new Error(`Template no soportado: ${email.template}`);
  }

  private async markSent(id: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE "email_outbox"
       SET "status" = $1,
           "sentAt" = now(),
           "lastError" = NULL,
           "payload" = '{}'::jsonb,
           "updatedAt" = now()
       WHERE "id" = $2`,
      [EmailOutboxStatus.SENT, id],
    );
  }

  private async markFailed(email: ClaimedEmail, error: unknown): Promise<void> {
    const attempts = Number(email.attempts) + 1;
    const maxAttempts = Number(
      this.configService.get<string>('MAIL_MAX_ATTEMPTS') || 5,
    );
    const failed = attempts >= maxAttempts;
    const delayMinutes = Math.min(2 ** attempts, 60);
    const lastError = this.errorMessage(error).slice(0, 1000);

    await this.dataSource.query(
      `UPDATE "email_outbox"
       SET "status" = $1,
           "attempts" = $2,
           "nextAttemptAt" = now() + ($3 || ' minutes')::interval,
           "lastError" = $4,
           "updatedAt" = now()
       WHERE "id" = $5`,
      [
        failed ? EmailOutboxStatus.FAILED : EmailOutboxStatus.PENDING,
        attempts,
        delayMinutes,
        lastError,
        email.id,
      ],
    );

    this.logger.error(
      `No se pudo enviar email ${email.id} (intento ${attempts}/${maxAttempts}): ${lastError}`,
    );
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
