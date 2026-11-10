import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsMessage, SmsProvider } from './sms.types';

/**
 * Proveedor SMS basado en la API REST de Twilio.
 * Requiere variables de entorno: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.
 * Se activa cuando SMS_PROVIDER=twilio.
 */
@Injectable()
export class TwilioSmsProvider implements SmsProvider {
  private readonly logger = new Logger(TwilioSmsProvider.name);
  private readonly accountSid: string | undefined;
  private readonly authToken: string | undefined;
  private readonly fromNumber: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    this.authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.configService.get<string>('TWILIO_FROM_NUMBER');
  }

  isEnabled(): boolean {
    return !!(
      this.accountSid &&
      this.authToken &&
      this.fromNumber &&
      process.env.SMS_ENABLED === 'true'
    );
  }

  async send(message: SmsMessage): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.warn('Twilio SMS provider no está habilitado. Mensaje no enviado.');
      return;
    }

    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    const formData = new URLSearchParams();
    formData.set('From', this.fromNumber!);
    formData.set('To', message.to);
    formData.set('Body', message.text);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Error enviando SMS via Twilio: ${response.status} ${errorText}`,
        );
        throw new Error(`Twilio SMS error: ${response.status}`);
      }

      this.logger.log(`SMS enviado via Twilio a ${message.to}`);
    } catch (error) {
      this.logger.error(`Excepción enviando SMS via Twilio: ${error}`);
      throw error;
    }
  }
}
