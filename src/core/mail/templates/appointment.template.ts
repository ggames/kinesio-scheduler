import type { MailMessage } from '../mail.types';

export type AppointmentEmailTemplate =
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'appointment_reminder';

export interface AppointmentTemplatePayload {
  firstName?: string;
  date?: string;
  time?: string;
  professionalName?: string;
  reason?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SUBJECTS: Record<AppointmentEmailTemplate, string> = {
  appointment_confirmed: 'Tu turno fue confirmado',
  appointment_cancelled: 'Tu turno fue cancelado',
  appointment_rescheduled: 'Tu turno fue reprogramado',
  appointment_reminder: 'Recordatorio de turno',
};

const INTROS: Record<AppointmentEmailTemplate, string> = {
  appointment_confirmed: 'Tu turno fue confirmado.',
  appointment_cancelled: 'Tu turno fue cancelado.',
  appointment_rescheduled: 'Tu turno fue reprogramado.',
  appointment_reminder: 'Te recordamos que tenés un turno próximo.',
};

export function renderAppointmentEmail(
  template: AppointmentEmailTemplate,
  to: string,
  payload: AppointmentTemplatePayload,
): MailMessage {
  const name = (payload.firstName ?? '').trim() || 'paciente';
  const date = (payload.date ?? '').trim();
  const time = (payload.time ?? '').trim();
  const professionalName = (payload.professionalName ?? '').trim();
  const reason = (payload.reason ?? '').trim();

  const detailLines = [
    date ? `Fecha: ${date}` : '',
    time ? `Hora: ${time}` : '',
    professionalName ? `Profesional: ${professionalName}` : '',
    reason ? `Motivo: ${reason}` : '',
  ].filter(Boolean);

  const safeLines = detailLines.map(escapeHtml);

  return {
    to,
    subject: SUBJECTS[template],
    text: [
      `Hola ${name},`,
      '',
      INTROS[template],
      ...detailLines,
      '',
      'Si necesitás modificar o cancelar el turno, ingresá a la aplicación.',
    ].join('\n'),
    html: [
      `<p>Hola ${escapeHtml(name)},</p>`,
      `<p>${escapeHtml(INTROS[template])}</p>`,
      safeLines.length > 0
        ? `<ul>${safeLines.map((line) => `<li>${line}</li>`).join('')}</ul>`
        : '',
      '<p>Si necesitás modificar o cancelar el turno, ingresá a la aplicación.</p>',
    ].join(''),
  };
}
