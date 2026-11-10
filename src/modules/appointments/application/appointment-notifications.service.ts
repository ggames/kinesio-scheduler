import { Injectable, Logger } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { MailService } from '../../../core/mail/mail.service';
import type { AppointmentEmailTemplate } from '../../../core/mail/templates/appointment.template';
import { Appointment } from '../domain/appointment.entity';

@Injectable()
export class AppointmentNotificationsService {
  private readonly logger = new Logger(AppointmentNotificationsService.name);

  constructor(private readonly mailService: MailService) {}

  async enqueue(
    manager: EntityManager,
    appointment: Appointment,
    template: AppointmentEmailTemplate,
    reason?: string,
  ): Promise<void> {
    const patient = appointment.patient as any;
    const person = patient?.person;
    const email = person?.email;
    if (!email) {
      this.logger.warn(
        `Turno ${appointment.id} sin email de paciente; no se encola notificación`,
      );
      return;
    }

    if (person?.userId) {
      const rows: { emailEnabled: boolean; appointmentReminders: boolean; appointmentChanges: boolean }[] =
        await manager.query(
          `SELECT "emailEnabled", "appointmentReminders", "appointmentChanges"
           FROM "notification_preferences" WHERE "userId" = $1`,
          [person.userId],
        );
      const preferences = rows[0];
      if (preferences) {
        if (!preferences.emailEnabled) return;
        if (
          template === 'appointment_reminder' &&
          !preferences.appointmentReminders
        ) {
          return;
        }
        if (
          template !== 'appointment_reminder' &&
          !preferences.appointmentChanges
        ) {
          return;
        }
      }
    }

    const professionalPerson = (appointment.professional as any)?.person;
    const professionalName = professionalPerson
      ? `${professionalPerson.firstName ?? ''} ${professionalPerson.lastName ?? ''}`.trim()
      : '';

    const slot = appointment.timeSlot as any;
    const rawDate = slot?.agenda?.date;
    const date =
      typeof rawDate === 'string'
        ? rawDate.substring(0, 10)
        : rawDate instanceof Date
          ? rawDate.toISOString().slice(0, 10)
          : '';
    const time = typeof slot?.startTime === 'string' ? slot.startTime.slice(0, 5) : '';

    try {
      await this.mailService.enqueueAppointmentEmail(manager, {
        to: email,
        firstName: person?.firstName ?? '',
        template,
        date,
        time,
        professionalName,
        reason,
        clinicId: appointment.clinicId ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `No se pudo encolar notificación de turno ${appointment.id}: ${message}`,
      );
    }
  }
}
