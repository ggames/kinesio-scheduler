import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MailModule } from '../core/mail/mail.module';
import { SmsModule } from '../core/sms/sms.module';
import { AttachmentsModule } from '../modules/attachments/attachments.module';
import { EmailOutbox } from '../core/mail/domain/email-outbox.entity';

@Module({
  imports: [
    MailModule,
    SmsModule,
    AttachmentsModule,
    TypeOrmModule.forFeature([EmailOutbox]),
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
