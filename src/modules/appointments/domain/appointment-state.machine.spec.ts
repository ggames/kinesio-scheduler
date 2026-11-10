import { AppointmentStatus } from './appointment.entity';
import {
  canTransition,
  isTerminalStatus,
  occupiesCapacity,
} from './appointment-state.machine';

describe('appointment state machine', () => {
  it('permite las transiciones válidas', () => {
    expect(canTransition(AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED)).toBe(true);
    expect(canTransition(AppointmentStatus.SCHEDULED, AppointmentStatus.CANCELLED)).toBe(true);
    expect(canTransition(AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED)).toBe(true);
    expect(canTransition(AppointmentStatus.CONFIRMED, AppointmentStatus.NO_SHOW)).toBe(true);
  });

  it('rechaza transiciones desde estados terminales', () => {
    expect(canTransition(AppointmentStatus.CANCELLED, AppointmentStatus.SCHEDULED)).toBe(false);
    expect(canTransition(AppointmentStatus.COMPLETED, AppointmentStatus.CONFIRMED)).toBe(false);
    expect(canTransition(AppointmentStatus.NO_SHOW, AppointmentStatus.COMPLETED)).toBe(false);
  });

  it('marca correctamente los estados terminales', () => {
    expect(isTerminalStatus(AppointmentStatus.CANCELLED)).toBe(true);
    expect(isTerminalStatus(AppointmentStatus.NO_SHOW)).toBe(true);
    expect(isTerminalStatus(AppointmentStatus.SCHEDULED)).toBe(false);
  });

  it('solo los estados activos ocupan capacidad', () => {
    expect(occupiesCapacity(AppointmentStatus.SCHEDULED)).toBe(true);
    expect(occupiesCapacity(AppointmentStatus.CONFIRMED)).toBe(true);
    expect(occupiesCapacity(AppointmentStatus.COMPLETED)).toBe(true);
    expect(occupiesCapacity(AppointmentStatus.CANCELLED)).toBe(false);
    expect(occupiesCapacity(AppointmentStatus.NO_SHOW)).toBe(false);
  });
});
