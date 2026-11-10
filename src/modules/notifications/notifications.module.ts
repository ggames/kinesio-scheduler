import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../../core/mail/mail.module';
import { SmsModule } from '../../core/sms/sms.module';
import { AuditModule } from '../../core/audit/audit.module';
import { NotificationPreference } from './domain/notification-preference.entity';
import { NotificationPreferencesService } from './application/notification-preferences.service';
import { NotificationPreferencesController } from './infrastructure/notification-preferences.controller';
import { OutboxController } from './infrastructure/outbox.controller';
import { MyNotificationsController } from './infrastructure/my-notifications.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationPreference]),
    MailModule,
    SmsModule,
    AuditModule,
  ],
  controllers: [
    NotificationPreferencesController,
    OutboxController,
    MyNotificationsController,
  ],
  providers: [NotificationPreferencesService],
  exports: [NotificationPreferencesService],
})
export class NotificationsModule {}
