import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SMS_PROVIDER } from './sms.types';
import { LogSmsProvider } from './log-sms.provider';
import { TwilioSmsProvider } from './twilio-sms.provider';

export function smsProviderFactory(configService: ConfigService) {
  const provider = configService.get<string>('SMS_PROVIDER') || 'log';
  if (provider === 'twilio') {
    return new TwilioSmsProvider(configService);
  }
  return new LogSmsProvider();
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SMS_PROVIDER,
      useFactory: smsProviderFactory,
      inject: [ConfigService],
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
