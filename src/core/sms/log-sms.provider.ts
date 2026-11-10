import { Injectable, Logger } from '@nestjs/common';
import type { SmsMessage, SmsProvider } from './sms.types';

/**
 * Placeholder SMS provider. It logs messages instead of sending them so the
 * application can integrate a real gateway (Twilio, etc.) later.
 */
@Injectable()
export class LogSmsProvider implements SmsProvider {
  private readonly logger = new Logger(LogSmsProvider.name);

  isEnabled(): boolean {
    return process.env.SMS_ENABLED === 'true';
  }

  async send(message: SmsMessage): Promise<void> {
    if (!this.isEnabled()) return;
    this.logger.log(`SMS a ${message.to}: ${message.text}`);
  }
}
