import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailService } from '../../../core/mail/mail.service';
import { SMS_PROVIDER } from '../../../core/sms/sms.types';
import { Inject } from '@nestjs/common';
import type { SmsProvider } from '../../../core/sms/sms.types';
import { Appointment } from '../domain/appointment.entity';
import type { AppointmentEmailTemplate } from '../../../core/mail/templates/appointment.template';

@Injectable()
export class ReminderCronService implements OnModuleInit {
  private readonly logger = new Logger(ReminderCronService.name);
  private readonly reminderHours: number;
  private enabled = false;

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {
    this.reminderHours = Number(
      this.configService.get<string>('REMINDER_HOURS') || '24',
    );
    this.enabled =
      this.configService.get<string>('REMINDER_CRON_ENABLED') === 'true';
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log('Recordatorios T-24h deshabilitados (REMINDER_CRON_ENABLED != true)');
    }
  }

  /**
   * Ejecuta cada 15 minutos. Busca citas SCHEDULED que inicien entre
   * reminderHours y reminderHours+15 minutos desde ahora, y les envía un
   * recordatorio si aún no se ha enviado (idempotencia vía email_outbox).
   */
  @Cron('0 */15 * * * *')
  async sendUpcomingAppointmentReminders() {
    if (!this.enabled) return;

    this.logger.log('Iniciando envío de recordatorios de citas próximas');

    const now = new Date();
    const windowStart = new Date(
      now.getTime() + this.reminderHours * 60 * 60 * 1000,
    );
    const windowEnd = new Date(
      windowStart.getTime() + 15 * 60 * 1000,
    );

    const upcoming = await this.appointmentRepository.find({
      where: {
        status: 'SCHEDULED',
      },
      relations: {
        patient: { person: true },
        professional: { person: true },
        timeSlot: { agenda: true },
      },
    });

    const startMs = windowStart.getTime();
    const endMs = windowEnd.getTime();

    for (const appointment of upcoming) {
      const slot = (appointment as any).timeSlot;
      const agenda = slot?.agenda;
      const rawDate = agenda?.date;
      const dateStr =
        typeof rawDate === 'string'
          ? rawDate.substring(0, 10)
          : rawDate instanceof Date
            ? rawDate.toISOString().slice(0, 10)
            : '';
      const timeStr =
        typeof slot?.startTime === 'string' ? slot.startTime.slice(0, 5) : '';
      const appointmentStartMs = dateStr
        ? new Date(`${dateStr}T${timeStr}:00`).getTime()
        : 0;

      if (appointmentStartMs < startMs || appointmentStartMs >= endMs) {
        continue;
      }

      const patient = (appointment as any).patient;
      const person = patient?.person;
      const email = person?.email;
      const phone = person?.phone;

      // Idempotencia: verificar si ya existe un recordatorio para esta cita
      const reminderKey = `reminder:${appointment.id}`;
      const existing = await this.appointmentRepository.query(
        `SELECT 1 FROM "idempotency_keys" WHERE "key" = $1`,
        [reminderKey],
      );
      if (existing.length > 0) {
        this.logger.log(`Recordatorio ya enviado para cita ${appointment.id}`);
        continue;
      }

      try {
        if (email) {
          await this.mailService.enqueueAppointmentEmail(
            undefined as any,
            {
              to: email,
              firstName: person?.firstName ?? '',
              template: 'appointment_reminder' as AppointmentEmailTemplate,
              date: dateStr,
              time: timeStr,
              professionalName:
                (appointment.professional as any)?.person
                  ? `${(appointment.professional as any).person.firstName ?? ''} ${(appointment.professional as any).person.lastName ?? ''}`.trim()
                  : '',
              clinicId: appointment.clinicId ?? null,
            },
          );
        }

        if (phone && this.smsProvider.isEnabled()) {
          await this.smsProvider.send({
            to: phone,
            text: `Recordatorio: tiene una cita el ${dateStr} a las ${timeStr}.`,
          });
        }

        await this.appointmentRepository.query(
          `INSERT INTO "idempotency_keys" ("key", "createdAt") VALUES ($1, NOW())`,
          [reminderKey],
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Error enviando recordatorio para cita ${appointment.id}: ${message}`,
        );
      }
    }

    this.logger.log(
      `Recordatorios procesados: ${upcoming.length} citas candidatas`,
    );
  }
}
