import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailOutbox } from './domain/email-outbox.entity';
import { MailService } from './mail.service';
import { MAIL_PROVIDER } from './mail.types';
import { OutboxProcessor } from './outbox.processor';
import { SmtpMailProvider } from './providers/smtp-mail.provider';
import { TokenCipher } from './token-cipher';

@Module({
  imports: [TypeOrmModule.forFeature([EmailOutbox])],
  providers: [
    MailService,
    TokenCipher,
    OutboxProcessor,
    {
      provide: MAIL_PROVIDER,
      useClass: SmtpMailProvider,
    },
  ],
  exports: [MailService],
})
export class MailModule {}
