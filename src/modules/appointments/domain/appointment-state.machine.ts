import { AppointmentStatus } from './appointment.entity';

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.SCHEDULED]: [
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.COMPLETED,
  ],
  [AppointmentStatus.CONFIRMED]: [
    AppointmentStatus.CANCELLED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.COMPLETED]: [],
  [AppointmentStatus.CANCELLED]: [],
  [AppointmentStatus.NO_SHOW]: [],
};

export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.COMPLETED,
];

export function canTransition(
  from: AppointmentStatus | string,
  to: AppointmentStatus | string,
): boolean {
  return (TRANSITIONS[from as AppointmentStatus] ?? []).includes(
    to as AppointmentStatus,
  );
}

export function isTerminalStatus(status: AppointmentStatus | string): boolean {
  return (
    status === AppointmentStatus.COMPLETED ||
    status === AppointmentStatus.CANCELLED ||
    status === AppointmentStatus.NO_SHOW
  );
}

export function occupiesCapacity(status: AppointmentStatus | string): boolean {
  return status !== AppointmentStatus.CANCELLED && status !== AppointmentStatus.NO_SHOW;
}
