import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Appointment, AppointmentStatus } from '../../domain/appointment.entity';
import { AppointmentNotificationsService } from '../appointment-notifications.service';
import { CronLockService } from '../../../../core/scheduling/cron-lock.service';

interface ReminderRow {
  id: string;
}

@Injectable()
export class AppointmentReminderTask {
  private readonly logger = new Logger(AppointmentReminderTask.name);
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifications: AppointmentNotificationsService,
    private readonly configService: ConfigService,
    private readonly cronLock: CronLockService,
  ) {}

  @Cron('*/15 * * * *')
  async handleReminders(): Promise<void> {
    if (this.running) return;

    await this.cronLock.runWithLock('appointments.reminders', 10 * 60 * 1000, async () => {
      this.running = true;
      try {
        await this.processReminders();
      } finally {
        this.running = false;
      }
    });
  }

  private async processReminders(): Promise<void> {
    try {
      const reminderHours = this.numberConfig('REMINDER_HOURS', 24);
      const rows: ReminderRow[] = await this.dataSource.query(
        `SELECT a.id
         FROM appointments a
         JOIN time_slots ts ON ts.id = a."timeSlotId"
         JOIN daily_agendas da ON da.id = ts."agendaId"
         WHERE a.status IN ($1, $2)
           AND a."reminderSentAt" IS NULL
           AND (da.date + ts."startTime") BETWEEN now() AND now() + ($3 || ' hours')::interval
         ORDER BY (da.date + ts."startTime") ASC
         LIMIT 50`,
        [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, reminderHours],
      );

      let sent = 0;
      for (const row of rows) {
        const processed = await this.dataSource.transaction(async (manager) => {
          const appointment = await manager.findOne(Appointment, {
            where: { id: row.id },
            lock: { mode: 'pessimistic_write' },
          });
          if (!appointment || appointment.reminderSentAt) return false;

          const full = await manager.findOne(Appointment, {
            where: { id: row.id },
            relations: {
              patient: { person: true },
              professional: { person: true },
              timeSlot: { agenda: true },
              treatment: true,
            },
          });
          if (!full) return false;

          await this.notifications.enqueue(
            manager,
            full,
            'appointment_reminder',
          );

          appointment.reminderSentAt = new Date();
          await manager.save(Appointment, appointment);
          return true;
        });

        if (processed) sent++;
      }

      if (sent > 0) {
        this.logger.log(`Recordatorios de turno encolados: ${sent}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error procesando recordatorios de turno: ${message}`);
    }
  }

  private numberConfig(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
