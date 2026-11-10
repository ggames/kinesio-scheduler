import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsController } from './infrastructure/appointments.controller';
import { AppointmentsService } from './application/appointments.service';
import { Appointment } from './domain/appointment.entity';
import { TimeSlot } from '../agenda/time-slot/domain/time-slot.entity';
import { AppointmentsGateway } from '../../core/websockets/appointments.gateway';
import { SlotCapacityListener } from '../agenda/application/listeners/slot-capacity.listener';
import { AppointmentExpirationTask } from './application/tasks/appointment-expiration.task';
import { AppointmentReminderTask } from './application/tasks/appointment-reminder.task';
import { DataReconciliationTask } from './application/tasks/data-reconciliation.task';
import { AuthorizationModule } from '../../core/auth/authorization.module';
import { AuthModule } from '../../core/auth/auth.module';
import { AuditModule } from '../../core/audit/audit.module';
import { MailModule } from '../../core/mail/mail.module';
import { SmsModule } from '../../core/sms/sms.module';
import { TreatmentsModule } from '../treatments/treatments.module';
import { UsersModule } from '../users/users.module';
import { AppointmentNotificationsService } from './application/appointment-notifications.service';
import { IdempotencyModule } from '../../core/idempotency/idempotency.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, TimeSlot]),
    AuthorizationModule,
    AuthModule,
    AuditModule,
    MailModule,
    SmsModule,
    TreatmentsModule,
    UsersModule,
    IdempotencyModule,
  ],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    AppointmentsGateway,
    SlotCapacityListener,
    AppointmentExpirationTask,
    AppointmentReminderTask,
    DataReconciliationTask,
    AppointmentNotificationsService,
  ],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
