import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { MailMessage, MailProvider } from '../mail.types';

@Injectable()
export class SmtpMailProvider implements MailProvider {
  private readonly logger = new Logger(SmtpMailProvider.name);
  private readonly transporter?: Transporter;
  private readonly from: string;
  private readonly enabled: boolean;

  constructor(configService: ConfigService) {
    const host = configService.get<string>('MAIL_HOST')?.trim();
    const user = configService.get<string>('MAIL_USER')?.trim();
    const pass = configService.get<string>('MAIL_PASS');
    const fromAddress =
      configService.get<string>('MAIL_FROM')?.trim() || 'no-reply@kinesiology.local';
    const fromName =
      configService.get<string>('MAIL_FROM_NAME')?.trim() || 'Kinesiology Scheduler';

    this.enabled =
      configService.get<string>('MAIL_ENABLED') !== 'false' && !!host;
    this.from = `"${fromName}" <${fromAddress}>`;

    if (!this.enabled) {
      this.logger.warn(
        'Envío de emails deshabilitado o MAIL_HOST no configurado; los emails quedarán en outbox.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(configService.get<string>('MAIL_PORT') || 587),
      secure: configService.get<string>('MAIL_SECURE') === 'true',
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      throw new Error('MAIL_HOST no está configurado');
    }

    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
