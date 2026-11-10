import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppointmentsService } from './appointments.service';
import { Appointment, AppointmentStatus } from '../domain/appointment.entity';
import {
  TimeSlot,
  TimeSlotStatus,
} from '../../agenda/time-slot/domain/time-slot.entity';
import { DailyAgenda } from '../../agenda/daily-agenda/domain/daily-agenda.entity';
import { AuthorizationService } from '../../../core/auth/authorization.service';
import { AuditService } from '../../../core/audit/audit.service';
import { AuditEventType } from '../../../core/audit/domain/audit-log.entity';
import { TreatmentsService } from '../../treatments/application/treatments.service';
import { AppointmentNotificationsService } from './appointment-notifications.service';

const patientUser = { userId: 'user-1', role: 'PATIENT', roles: ['PATIENT'] };
const staffUser = { userId: 'staff-1', role: 'STAFF', roles: ['STAFF'] };

function dateString(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function makeAgenda(id: string, date: string) {
  return {
    id,
    date,
    professional: {
      id: 'prof-1',
      person: { firstName: 'Ana', lastName: 'Pérez' },
    },
  } as any;
}

function makeSlot(overrides: Record<string, any> = {}): TimeSlot {
  const agenda = overrides.agenda ?? makeAgenda('agenda-1', dateString(5));
  return {
    id: 'slot-1',
    agendaId: agenda.id,
    agenda,
    weeklySchedule: null as any,
    doctorScheduleTemplate: null as any,
    startTime: '09:00:00',
    endTime: '10:00:00',
    maxCapacity: 2,
    currentBookings: 0,
    status: TimeSlotStatus.AVAILABLE,
    ...overrides,
  } as TimeSlot;
}

function makeAppointment(
  slot: TimeSlot,
  overrides: Record<string, any> = {},
): Appointment {
  return {
    id: 'appt-1',
    status: AppointmentStatus.SCHEDULED,
    patient: {
      id: 'patient-1',
      person: {
        userId: 'user-1',
        firstName: 'Juan',
        lastName: 'Gómez',
        email: 'juan@example.com',
      },
    },
    professional: {
      id: 'prof-1',
      person: { userId: 'prof-user', firstName: 'Ana', lastName: 'Pérez' },
    },
    timeSlot: slot,
    treatment: { id: 'treatment-1' },
    createdAt: new Date(),
    ...overrides,
  } as any;
}

interface ManagerOptions {
  slots?: TimeSlot[];
  appointment?: Appointment | null;
  existingAppointments?: Appointment[];
  activeCount?: number;
}

function buildManager(options: ManagerOptions = {}) {
  const slots = new Map<string, TimeSlot>(
    (options.slots ?? [makeSlot()]).map((slot) => [slot.id, slot]),
  );
  const agendas = new Map<string, DailyAgenda>();
  for (const slot of slots.values()) {
    const agenda = slot.agenda as DailyAgenda;
    if (agenda?.id) agendas.set(agenda.id, agenda);
  }

  let current = options.appointment ? { ...options.appointment } : null;

  const findOne = jest
    .fn()
    .mockImplementation(async (target: any, opts?: any) => {
      const name = typeof target === 'function' ? target.name : String(target);
      if (name === 'TimeSlot') {
        const id = opts?.where?.id;
        const slot = id ? slots.get(id) : undefined;
        return slot ? { ...slot } : null;
      }
      if (name === 'Appointment') {
        if (!current) return null;
        const slot = slots.get((current.timeSlot as any)?.id);
        return {
          ...current,
          timeSlot: slot ?? current.timeSlot,
        };
      }
      if (name === 'DailyAgenda') {
        const id = opts?.where?.id;
        return id ? (agendas.get(id) ?? null) : null;
      }
      return null;
    });

    const create = jest.fn().mockImplementation((target: any, entity: any) => {
      const name = typeof target === 'function' ? target.name : String(target);
      if (name === 'Appointment') {
        return { id: 'appt-new', idCalls: undefined, ...entity };
      }
      return entity;
    });

    const save = jest.fn().mockImplementation((target: any, entity: any) => {
      const name = typeof target === 'function' ? target.name : String(target);
      if (name === 'Appointment') {
        current = { ...entity };
      }
      return entity;
    });

    const find = (jest.fn() as any).mockResolvedValue(
      options.existingAppointments ?? [],
    );
    const count = (jest.fn() as any).mockResolvedValue(options.activeCount ?? 0);

    const createQueryBuilder = jest.fn().mockImplementation(() => ({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: ((jest.fn() as any).mockResolvedValue(0) as any),
    }));

    return { findOne, find, count, create, save, createQueryBuilder };
}

function buildDataSource(manager: any) {
  return {
    transaction: jest.fn().mockImplementation(async (cb: any) => cb(manager)),
  };
}

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let auditService: any;
  let notifications: any;
  let treatmentsService: any;
  let authorizationService: any;
  let eventEmitter: any;
  let configService: any;

  async function buildService(manager: any) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: (jest.fn() as any).mockImplementation(() => ({
              innerJoin: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getCount: (jest.fn() as any).mockResolvedValue(0),
            })),
          },
        },
        { provide: getDataSourceToken(), useValue: buildDataSource(manager) },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: AuthorizationService, useValue: authorizationService },
        { provide: AuditService, useValue: auditService },
        { provide: TreatmentsService, useValue: treatmentsService },
        {
          provide: AppointmentNotificationsService,
          useValue: notifications,
        },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    return module.get<AppointmentsService>(AppointmentsService);
  }

  beforeEach(() => {
    auditService = { record: (jest.fn() as any).mockResolvedValue(undefined) };
    notifications = { enqueue: (jest.fn() as any).mockResolvedValue(undefined) };
    treatmentsService = {
      recordCompletedSession: (jest.fn() as any).mockResolvedValue({
        session: {
          id: 'session-1',
          treatmentId: 'treatment-1',
          sessionNumber: 1,
        },
        treatmentCompleted: false,
      }),
    };
    authorizationService = {
      getPatientIdForUser: (jest.fn() as any).mockResolvedValue('patient-1'),
      getPatientClinicId: (jest.fn() as any).mockResolvedValue('clinic-1'),
      getDefaultClinicId: (jest.fn() as any).mockResolvedValue('clinic-1'),
      getProfessionalIdForUser: (jest.fn() as any).mockResolvedValue('prof-1'),
      assertCanViewAppointment: (jest.fn() as any).mockResolvedValue(undefined),
      assertCanManageAppointment: (jest.fn() as any).mockResolvedValue(undefined),
      assertStaffCanManageAppointment: (jest.fn() as any).mockResolvedValue(
        undefined,
      ),
      assertCanCompleteAppointment: (jest.fn() as any).mockResolvedValue(
        undefined,
      ),
    };
    eventEmitter = { emit: jest.fn() };
    configService = {
      get: (jest.fn() as any).mockReturnValue('24'),
    };
  });

  it('crea un turno en fecha futura y emite el evento de capacidad', async () => {
    const manager = buildManager();
    service = await buildService(manager);

    const result = await service.create(
      {
        patientId: 'patient-1',
        professionalId: 'prof-1',
        timeSlotId: 'slot-1',
      },
      patientUser,
    );

    expect(result.id).toBe('appt-new');
    expect(result.appointmentDate).toBe(dateString(5));
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'slot.capacity.updated',
      expect.objectContaining({ slotId: 'slot-1' }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: AuditEventType.APPOINTMENT_CREATED }),
    );
  });

  it('rechaza turnos pasados para pacientes', async () => {
    const slot = makeSlot({ agenda: makeAgenda('agenda-past', dateString(-5)) });
    service = await buildService(buildManager({ slots: [slot] }));

    await expect(
      service.create(
        {
          patientId: 'patient-1',
          professionalId: 'prof-1',
          timeSlotId: slot.id,
        },
        patientUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('permite carga histórica a STAFF', async () => {
    const slot = makeSlot({ agenda: makeAgenda('agenda-past', dateString(-5)) });
    service = await buildService(buildManager({ slots: [slot] }));

    await expect(
      service.create(
        {
          patientId: 'patient-1',
          professionalId: 'prof-1',
          timeSlotId: slot.id,
        },
        staffUser,
      ),
    ).resolves.toBeDefined();
  });

  it('rechaza cuando el slot alcanzó su capacidad máxima', async () => {
    const slot = makeSlot({ maxCapacity: 2 });
    service = await buildService(buildManager({ slots: [slot], activeCount: 2 }));

    await expect(
      service.create(
        {
          patientId: 'patient-1',
          professionalId: 'prof-1',
          timeSlotId: slot.id,
        },
        patientUser,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rechaza cuando el slot no existe', async () => {
    service = await buildService(buildManager({ slots: [] }));

    await expect(
      service.create(
        {
          patientId: 'patient-1',
          professionalId: 'prof-1',
          timeSlotId: 'missing',
        },
        patientUser,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('cancela un turno futuro del paciente y recalcula el slot', async () => {
    const slot = makeSlot();
    const appointment = makeAppointment(slot);
    const manager = buildManager({ slots: [slot], appointment });
    service = await buildService(manager);

    const result = await service.cancel(
      appointment.id,
      { reason: 'No puedo asistir' },
      patientUser,
    );

    expect(result.status).toBe(AppointmentStatus.CANCELLED);
    expect(result.cancellationReason).toBe('No puedo asistir');
    expect(notifications.enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ id: appointment.id }),
      'appointment_cancelled',
      'No puedo asistir',
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.APPOINTMENT_CANCELLED,
      }),
    );
  });

  it('impide al paciente cancelar dentro de la ventana de 24 horas', async () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    const localDate = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
    const localTime = `${String(soon.getHours()).padStart(2, '0')}:${String(soon.getMinutes()).padStart(2, '0')}:00`;
    const slot = makeSlot({
      agenda: makeAgenda('agenda-today', localDate),
      startTime: localTime,
      endTime: localTime,
    });
    const appointment = makeAppointment(slot);
    service = await buildService(buildManager({ slots: [slot], appointment }));

    await expect(
      service.cancel(appointment.id, {}, patientUser),
    ).rejects.toThrow(BadRequestException);
  });

  it('reprograma el turno, lo vuelve SCHEDULED y notifica', async () => {
    const oldSlot = makeSlot({ id: 'slot-old' });
    const newSlot = makeSlot({
      id: 'slot-new',
      agenda: makeAgenda('agenda-new', dateString(6)),
      agendaId: 'agenda-new',
    });
    const appointment = makeAppointment(oldSlot, {
      status: AppointmentStatus.CONFIRMED,
      confirmedAt: new Date(),
    });
    const manager = buildManager({
      slots: [oldSlot, newSlot],
      appointment,
    });
    service = await buildService(manager);

    const result = await service.reschedule(
      appointment.id,
      { timeSlotId: 'slot-new', reason: 'Cambio de horario' },
      patientUser,
    );

    expect(result.status).toBe(AppointmentStatus.SCHEDULED);
    expect(result.appointmentDate).toBe(dateString(6));
    expect(notifications.enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ id: appointment.id }),
      'appointment_rescheduled',
      'Cambio de horario',
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.APPOINTMENT_RESCHEDULED,
        metadata: expect.objectContaining({
          oldTimeSlotId: 'slot-old',
          newTimeSlotId: 'slot-new',
        }),
      }),
    );
  });

  it('completa el turno y registra la sesión del tratamiento', async () => {
    const slot = makeSlot();
    const appointment = makeAppointment(slot, {
      status: AppointmentStatus.CONFIRMED,
    });
    const manager = buildManager({ slots: [slot], appointment });
    service = await buildService(manager);

    const result = await service.complete(
      appointment.id,
      { notes: 'Evolución favorable' },
      staffUser,
    );

    expect(result.status).toBe(AppointmentStatus.COMPLETED);
    expect(treatmentsService.recordCompletedSession).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ id: appointment.id }),
      'Evolución favorable',
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.TREATMENT_SESSION_COMPLETED,
      }),
    );
  });

  it('no permite completar dos veces y no duplica la sesión', async () => {
    const slot = makeSlot();
    const appointment = makeAppointment(slot, {
      status: AppointmentStatus.COMPLETED,
    });
    service = await buildService(
      buildManager({ slots: [slot], appointment }),
    );

    const result = await service.complete(appointment.id, {}, staffUser);

    expect(result.status).toBe(AppointmentStatus.COMPLETED);
    expect(treatmentsService.recordCompletedSession).not.toHaveBeenCalled();
  });
});
