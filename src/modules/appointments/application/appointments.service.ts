import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  Not,
  Repository,
} from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Appointment, AppointmentStatus } from '../domain/appointment.entity';
import {
  canTransition,
  isTerminalStatus,
  occupiesCapacity,
} from '../domain/appointment-state.machine';
import {
  TimeSlot,
  TimeSlotStatus,
} from '../../agenda/time-slot/domain/time-slot.entity';
import { Patient } from '../../patients/domain/patient.entity';
import { DailyAgenda } from '../../agenda/daily-agenda/domain/daily-agenda.entity';
import { TimeSlotCapacityUpdatedEvent } from '../../agenda/domain/events/time-slot-capacity-updated.event';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import {
  CancelAppointmentDto,
  CompleteAppointmentDto,
  FindAppointmentsQueryDto,
  RescheduleAppointmentDto,
} from './dto/appointment-actions.dto';
import { AuthorizationService } from '../../../core/auth/authorization.service';
import {
  ADMIN,
  AuthenticatedUser,
  hasAnyRole,
  isStaff,
} from '../../../core/auth/roles';
import { AuditService } from '../../../core/audit/audit.service';
import { AuditEventType } from '../../../core/audit/domain/audit-log.entity';
import { TreatmentsService } from '../../treatments/application/treatments.service';
import { AppointmentNotificationsService } from './appointment-notifications.service';

const DEFAULT_CANCELLATION_WINDOW_HOURS = 24;

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
    private readonly treatmentsService: TreatmentsService,
    private readonly notifications: AppointmentNotificationsService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    createDto: CreateAppointmentDto,
    user: AuthenticatedUser,
  ): Promise<any> {
    const appointment = await this.dataSource.transaction(async (manager) => {
      const slot = await this.lockSlot(manager, createDto.timeSlotId);

      if (!slot) {
        throw new NotFoundException(
          `El turno con ID ${createDto.timeSlotId} no existe`,
        );
      }

      await this.attachAgenda(manager, slot);

      await this.resolvePatient(createDto, user);

      if (!createDto.professionalId && slot.agenda?.professional?.id) {
        createDto.professionalId = slot.agenda.professional.id;
      }
      if (!createDto.professionalId) {
        throw new BadRequestException(
          'No se pudo determinar el profesional para el turno',
        );
      }

      const slotStart = this.slotStart(slot);
      if (
        slotStart &&
        slotStart.getTime() < Date.now() &&
        !isStaff(user)
      ) {
        throw new BadRequestException(
          'No se pueden reservar turnos en fechas u horas pasadas. Seleccione un horario futuro.',
        );
      }

      const datePart = this.slotDatePart(slot);
      const existingCount = await manager
        .createQueryBuilder(Appointment, 'appointment')
        .innerJoin('appointment.timeSlot', 'timeSlot')
        .innerJoin('timeSlot.agenda', 'agenda')
        .where('appointment.patientId = :patientId', {
          patientId: createDto.patientId,
        })
        .andWhere('appointment.status IN (:...statuses)', {
          statuses: [
            AppointmentStatus.SCHEDULED,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.COMPLETED,
          ],
        })
        .andWhere('agenda.date = :datePart', { datePart })
        .getCount();
      if (existingCount > 0) {
        throw new ConflictException(
          `El paciente ya posee un turno registrado para el día ${datePart}`,
        );
      }

      await this.assertSlotAvailable(manager, slot);

      const patient = await manager.findOne(Patient, {
        where: { id: createDto.patientId },
      });
      const clinicId =
        createDto.clinicId ??
        patient?.clinicId ??
        (await this.authorizationService.getDefaultClinicId());

      const entity = manager.create(Appointment, {
        patient: { id: createDto.patientId } as any,
        professional: { id: createDto.professionalId } as any,
        timeSlot: { id: createDto.timeSlotId } as any,
        treatment: createDto.treatmentId
          ? ({ id: createDto.treatmentId } as any)
          : undefined,
        clinic: clinicId ? ({ id: clinicId } as any) : undefined,
        clinicId,
        status: AppointmentStatus.SCHEDULED,
      });
      const saved = await manager.save(Appointment, entity);

      await this.recalculateSlot(manager, slot);

      const full = await this.loadAppointment(manager, saved.id);
      if (!full) {
        throw new NotFoundException(`Cita ${saved.id} no encontrada`);
      }
      return full;
    });

    await this.auditService.record({
      eventType: AuditEventType.APPOINTMENT_CREATED,
      actorUserId: user.userId,
      metadata: {
        appointmentId: appointment.id,
        patientId: (appointment.patient as any)?.id,
        professionalId: (appointment.professional as any)?.id,
        timeSlotId: (appointment.timeSlot as any)?.id,
      },
    });

    return this.withDate(appointment);
  }

  async findAll(
    query: FindAppointmentsQueryDto,
    user: AuthenticatedUser,
    clinicId?: string | null,
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const professionalId = hasAnyRole(user, ADMIN)
      ? query.professionalId
      : (await this.authorizationService.getProfessionalIdForUser(user.userId)) ??
        query.professionalId;

    const qb = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('patient.person', 'patientPerson')
      .leftJoinAndSelect('appointment.professional', 'professional')
      .leftJoinAndSelect('professional.person', 'professionalPerson')
      .leftJoinAndSelect('appointment.timeSlot', 'timeSlot')
      .leftJoinAndSelect('timeSlot.agenda', 'agenda')
      .leftJoinAndSelect('appointment.treatment', 'treatment')
      .orderBy('agenda.date', 'DESC')
      .addOrderBy('timeSlot.startTime', 'DESC');

    if (query.dateFrom) {
      qb.andWhere('agenda.date >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('agenda.date <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.status) {
      qb.andWhere('appointment.status = :status', { status: query.status });
    }
    if (professionalId) {
      qb.andWhere('professional.id = :professionalId', { professionalId });
    }
    if (query.patientId) {
      qb.andWhere('patient.id = :patientId', { patientId: query.patientId });
    }
    if (clinicId) {
      qb.andWhere('appointment.clinicId = :clinicId', { clinicId });
    }

    qb.skip((page - 1) * limit).take(limit);
    const [appointments, total] = await qb.getManyAndCount();

    return {
      data: appointments.map((appointment) => this.withDate(appointment)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<any> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: {
        patient: { person: true },
        professional: { person: true },
        timeSlot: { agenda: true },
        treatment: true,
      },
    });
    if (!appointment) {
      throw new NotFoundException(`Cita ${id} no encontrada`);
    }
    await this.authorizationService.assertCanViewAppointment(user, appointment);
    return this.withDate(appointment);
  }

  async confirm(id: string, user: AuthenticatedUser): Promise<any> {
    const result = await this.dataSource.transaction(async (manager) => {
      const appointment = await this.getActionAppointment(manager, id);
      await this.authorizationService.assertStaffCanManageAppointment(
        user,
        appointment,
      );

      if (appointment.status === AppointmentStatus.CONFIRMED) {
        return { appointment, changed: false };
      }
      if (
        !canTransition(appointment.status, AppointmentStatus.CONFIRMED)
      ) {
        throw new ConflictException(
          `No se puede confirmar un turno en estado ${appointment.status}`,
        );
      }

      appointment.status = AppointmentStatus.CONFIRMED;
      appointment.confirmedAt = new Date();
      await manager.save(Appointment, appointment);

      const full = await this.loadAppointment(manager, id);
      await this.notifications.enqueue(
        manager,
        full as Appointment,
        'appointment_confirmed',
      );
      return { appointment: full as Appointment, changed: true };
    });

    if (result.changed) {
      await this.auditService.record({
        eventType: AuditEventType.APPOINTMENT_CONFIRMED,
        actorUserId: user.userId,
        metadata: { appointmentId: id },
      });
    }

    return this.withDate(result.appointment);
  }

  async complete(
    id: string,
    dto: CompleteAppointmentDto,
    user: AuthenticatedUser,
  ): Promise<any> {
    const result = await this.dataSource.transaction(async (manager) => {
      const appointment = await this.getActionAppointment(manager, id);
      await this.authorizationService.assertCanCompleteAppointment(
        user,
        appointment,
      );

      if (appointment.status === AppointmentStatus.COMPLETED) {
        return {
          appointment,
          changed: false,
          session: null,
          treatmentCompleted: false,
        };
      }
      if (!canTransition(appointment.status, AppointmentStatus.COMPLETED)) {
        throw new ConflictException(
          `No se puede completar un turno en estado ${appointment.status}`,
        );
      }

      const professionalId =
        await this.authorizationService.getProfessionalIdForUser(user.userId);

      appointment.status = AppointmentStatus.COMPLETED;
      appointment.completedAt = new Date();
      appointment.notes = dto.notes ?? appointment.notes ?? null;
      appointment.attendedByProfessionalId =
        professionalId ?? (appointment.professional as any)?.id ?? null;
      await manager.save(Appointment, appointment);

      const treatmentResult =
        await this.treatmentsService.recordCompletedSession(
          manager,
          appointment,
          dto.notes,
        );

      const full = await this.loadAppointment(manager, id);
      return {
        appointment: full as Appointment,
        changed: true,
        session: treatmentResult.session,
        treatmentCompleted: treatmentResult.treatmentCompleted,
      };
    });

    if (result.changed) {
      await this.auditService.record({
        eventType: AuditEventType.APPOINTMENT_COMPLETED,
        actorUserId: user.userId,
        metadata: { appointmentId: id },
      });
      if (result.session) {
        await this.auditService.record({
          eventType: AuditEventType.TREATMENT_SESSION_COMPLETED,
          actorUserId: user.userId,
          metadata: {
            appointmentId: id,
            treatmentId: result.session.treatmentId,
            sessionNumber: result.session.sessionNumber,
          },
        });
      }
      if (result.treatmentCompleted) {
        await this.auditService.record({
          eventType: AuditEventType.TREATMENT_COMPLETED,
          actorUserId: user.userId,
          metadata: {
            appointmentId: id,
            treatmentId: result.session?.treatmentId,
          },
        });
      }
    }

    return this.withDate(result.appointment);
  }

  async noShow(id: string, user: AuthenticatedUser): Promise<any> {
    const result = await this.dataSource.transaction(async (manager) => {
      const appointment = await this.getActionAppointment(manager, id);
      await this.authorizationService.assertStaffCanManageAppointment(
        user,
        appointment,
      );

      if (appointment.status === AppointmentStatus.NO_SHOW) {
        return { appointment, changed: false };
      }
      if (!canTransition(appointment.status, AppointmentStatus.NO_SHOW)) {
        throw new ConflictException(
          `No se puede marcar ausencia en un turno en estado ${appointment.status}`,
        );
      }

      appointment.status = AppointmentStatus.NO_SHOW;
      appointment.noShowAt = new Date();
      await manager.save(Appointment, appointment);

      const slot = await this.lockSlot(
        manager,
        (appointment.timeSlot as any)?.id,
      );
      if (slot) {
        await this.attachAgenda(manager, slot);
        await this.recalculateSlot(manager, slot);
      }

      return {
        appointment: (await this.loadAppointment(manager, id)) as Appointment,
        changed: true,
      };
    });

    if (result.changed) {
      await this.auditService.record({
        eventType: AuditEventType.APPOINTMENT_NO_SHOW,
        actorUserId: user.userId,
        metadata: { appointmentId: id },
      });
    }

    return this.withDate(result.appointment);
  }

  async cancel(
    id: string,
    dto: CancelAppointmentDto,
    user: AuthenticatedUser,
  ): Promise<any> {
    const result = await this.dataSource.transaction(async (manager) => {
      const appointment = await this.getActionAppointment(manager, id);
      await this.authorizationService.assertCanManageAppointment(
        user,
        appointment,
      );

      if (appointment.status === AppointmentStatus.CANCELLED) {
        return { appointment, changed: false };
      }
      if (!canTransition(appointment.status, AppointmentStatus.CANCELLED)) {
        throw new ConflictException(
          `No se puede cancelar un turno en estado ${appointment.status}`,
        );
      }

      if (!isStaff(user)) {
        this.assertWithinCancellationWindow(appointment);
      }

      appointment.status = AppointmentStatus.CANCELLED;
      appointment.cancelledAt = new Date();
      appointment.cancelledByUserId = user.userId;
      appointment.cancellationReason =
        dto.reason?.trim() || 'Sin motivo especificado';
      await manager.save(Appointment, appointment);

      const slot = await this.lockSlot(
        manager,
        (appointment.timeSlot as any)?.id,
      );
      if (slot) {
        await this.attachAgenda(manager, slot);
        await this.recalculateSlot(manager, slot);
      }

      const full = (await this.loadAppointment(manager, id)) as Appointment;
      await this.notifications.enqueue(
        manager,
        full,
        'appointment_cancelled',
        appointment.cancellationReason ?? undefined,
      );

      return { appointment: full, changed: true };
    });

    if (result.changed) {
      await this.auditService.record({
        eventType: AuditEventType.APPOINTMENT_CANCELLED,
        actorUserId: user.userId,
        metadata: {
          appointmentId: id,
          reason: result.appointment.cancellationReason,
        },
      });
    }

    return this.withDate(result.appointment);
  }

  async reschedule(
    id: string,
    dto: RescheduleAppointmentDto,
    user: AuthenticatedUser,
  ): Promise<any> {
    const result = await this.dataSource.transaction(async (manager) => {
      const appointment = await this.getActionAppointment(manager, id);
      await this.authorizationService.assertCanManageAppointment(
        user,
        appointment,
      );

      if (isTerminalStatus(appointment.status)) {
        throw new ConflictException(
          `No se puede reprogramar un turno en estado ${appointment.status}`,
        );
      }

      if (!isStaff(user)) {
        this.assertWithinCancellationWindow(appointment);
      }

      const oldSlotId = (appointment.timeSlot as any)?.id;
      if (!oldSlotId) {
        throw new BadRequestException('El turno no tiene slot asignado');
      }
      if (oldSlotId === dto.timeSlotId) {
        return {
          appointment: (await this.loadAppointment(manager, id)) as Appointment,
          changed: false,
          oldSlotId,
        };
      }

      const orderedIds = [oldSlotId, dto.timeSlotId].sort();
      const slots = new Map<string, TimeSlot>();
      for (const slotId of orderedIds) {
        const slot = await this.lockSlot(manager, slotId);
        if (!slot) {
          throw new NotFoundException(`El turno con ID ${slotId} no existe`);
        }
        await this.attachAgenda(manager, slot);
        slots.set(slotId, slot);
      }

      const oldSlot = slots.get(oldSlotId) as TimeSlot;
      const newSlot = slots.get(dto.timeSlotId) as TimeSlot;

      const newStart = this.slotStart(newSlot);
      if (newStart && newStart.getTime() < Date.now() && !isStaff(user)) {
        throw new BadRequestException(
          'No se puede reprogramar a una fecha u hora pasada',
        );
      }
      await this.assertSlotAvailable(manager, newSlot);

      const newDatePart = this.slotDatePart(newSlot);
      const patientId = (appointment.patient as any)?.id;
      if (patientId && newDatePart) {
        const patientAppointments = await manager.find(Appointment, {
          where: { patient: { id: patientId } },
          relations: { timeSlot: { agenda: true } },
        });
        const patientHasSameDayAppointment = patientAppointments.some(
          (item) =>
            item.id !== appointment.id &&
            occupiesCapacity(item.status) &&
            this.slotDatePart(item.timeSlot) === newDatePart,
        );
        if (patientHasSameDayAppointment) {
          throw new ConflictException(
            `El paciente ya posee un turno registrado para el día ${newDatePart}`,
          );
        }
      }

      appointment.timeSlot = { id: newSlot.id } as any;
      appointment.status = AppointmentStatus.SCHEDULED;
      appointment.confirmedAt = null;
      appointment.reminderSentAt = null;
      appointment.rescheduledAt = new Date();
      appointment.rescheduledByUserId = user.userId;
      await manager.save(Appointment, appointment);

      await this.recalculateSlot(manager, oldSlot);
      await this.recalculateSlot(manager, newSlot);

      const full = (await this.loadAppointment(manager, id)) as Appointment;
      await this.notifications.enqueue(
        manager,
        full,
        'appointment_rescheduled',
        dto.reason,
      );

      return { appointment: full, changed: true, oldSlotId };
    });

    if (result.changed) {
      await this.auditService.record({
        eventType: AuditEventType.APPOINTMENT_RESCHEDULED,
        actorUserId: user.userId,
        metadata: {
          appointmentId: id,
          oldTimeSlotId: result.oldSlotId,
          newTimeSlotId: dto.timeSlotId,
          reason: dto.reason,
        },
      });
    }

    return this.withDate(result.appointment);
  }

  async findMyAppointments(userId: string): Promise<any[]> {
    if (!userId) {
      throw new BadRequestException('ID de usuario no proporcionado');
    }

    const appointments = await this.appointmentRepository.find({
      where: [
        { patient: { person: { userId } } },
        { professional: { person: { userId } } },
      ],
      relations: {
        patient: { person: true },
        professional: { person: true },
        timeSlot: { agenda: true },
        treatment: true,
      },
      order: { createdAt: 'DESC' },
    });

    return appointments.map((appointment) => this.withDate(appointment));
  }

  private async resolvePatient(
    dto: CreateAppointmentDto,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (!isStaff(user)) {
      const ownPatientId =
        await this.authorizationService.getPatientIdForUser(user.userId);
      if (!ownPatientId) {
        throw new BadRequestException(
          'No se encontró un perfil de paciente para el usuario autenticado',
        );
      }
      dto.patientId = ownPatientId;
      return;
    }

    if (!dto.patientId) {
      const ownPatientId =
        await this.authorizationService.getPatientIdForUser(user.userId);
      if (ownPatientId) {
        dto.patientId = ownPatientId;
      }
    }

    if (!dto.patientId) {
      throw new BadRequestException(
        'No se pudo determinar el perfil de paciente para el turno',
      );
    }
  }

  private async getActionAppointment(
    manager: EntityManager,
    id: string,
  ): Promise<Appointment> {
    // PostgreSQL no permite FOR UPDATE sobre el lado nullable de un LEFT JOIN.
    // Bloqueamos solo la fila del turno y luego cargamos las relaciones.
    const locked = await manager.findOne(Appointment, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!locked) {
      throw new NotFoundException(`Cita ${id} no encontrada`);
    }

    const appointment = await this.loadAppointment(manager, id);
    if (!appointment) {
      throw new NotFoundException(`Cita ${id} no encontrada`);
    }
    return appointment;
  }

  private async loadAppointment(
    manager: EntityManager,
    id: string,
  ): Promise<Appointment | null> {
    return manager.findOne(Appointment, {
      where: { id },
      relations: {
        patient: { person: true },
        professional: { person: true },
        timeSlot: { agenda: true },
        treatment: true,
      },
    });
  }

  private async lockSlot(
    manager: EntityManager,
    slotId?: string,
  ): Promise<TimeSlot | null> {
    if (!slotId) return null;
    return manager.findOne(TimeSlot, {
      where: { id: slotId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private async attachAgenda(
    manager: EntityManager,
    slot: TimeSlot,
  ): Promise<void> {
    if (!slot.agendaId) return;
    slot.agenda = (await manager.findOne(DailyAgenda, {
      where: { id: slot.agendaId },
      relations: { professional: true },
    })) as any;
  }

  private async assertSlotAvailable(
    manager: EntityManager,
    slot: TimeSlot,
  ): Promise<void> {
    if (
      slot.status === TimeSlotStatus.BLOCKED ||
      slot.status === TimeSlotStatus.EXPIRED
    ) {
      throw new ConflictException(
        'El turno solicitado se encuentra bloqueado o expirado',
      );
    }

    const activeCount = await manager.count(Appointment, {
      where: {
        timeSlot: { id: slot.id },
        status: Not(
          In([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]),
        ),
      },
    });

    if (activeCount >= slot.maxCapacity) {
      throw new ConflictException(
        `El turno solicitado alcanzó su capacidad máxima (${slot.maxCapacity})`,
      );
    }
  }

  private async recalculateSlot(
    manager: EntityManager,
    slot: TimeSlot,
  ): Promise<void> {
    const activeCount = await manager.count(Appointment, {
      where: {
        timeSlot: { id: slot.id },
        status: Not(
          In([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]),
        ),
      },
    });

    slot.currentBookings = activeCount;
    const remaining = slot.maxCapacity - slot.currentBookings;

    if (
      slot.status !== TimeSlotStatus.BLOCKED &&
      slot.status !== TimeSlotStatus.EXPIRED
    ) {
      slot.status =
        remaining <= 0 ? TimeSlotStatus.BOOKED : TimeSlotStatus.AVAILABLE;
    }

    await manager.save(TimeSlot, slot);

    this.eventEmitter.emit(
      'slot.capacity.updated',
      new TimeSlotCapacityUpdatedEvent(
        slot.id,
        Math.max(0, remaining),
        slot.status,
      ),
    );
  }

  private assertWithinCancellationWindow(appointment: Appointment): void {
    const start = this.slotStart(appointment.timeSlot);
    if (!start) return;

    const configured = Number(
      this.configService.get<string>('CANCELLATION_WINDOW_HOURS'),
    );
    const windowHours =
      Number.isFinite(configured) && configured >= 0
        ? configured
        : DEFAULT_CANCELLATION_WINDOW_HOURS;
    const cutoff = start.getTime() - windowHours * 60 * 60 * 1000;

    if (Date.now() > cutoff) {
      throw new BadRequestException(
        `Solo se puede cancelar o reprogramar con al menos ${windowHours} horas de anticipación`,
      );
    }
  }

  private slotStart(slot?: TimeSlot | null): Date | null {
    const datePart = this.slotDatePart(slot);
    if (!datePart || !slot?.startTime) return null;
    const timePart =
      slot.startTime.length === 5 ? `${slot.startTime}:00` : slot.startTime;
    const parsed = new Date(`${datePart}T${timePart}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private slotDatePart(slot?: TimeSlot | null): string {
    const rawDate: any = (slot?.agenda as any)?.date;
    if (!rawDate) return '';
    if (typeof rawDate === 'string') return rawDate.substring(0, 10);
    if (rawDate instanceof Date) return rawDate.toISOString().slice(0, 10);
    return String(rawDate).substring(0, 10);
  }

  private withDate(appointment: Appointment): any {
    return {
      ...appointment,
      appointmentDate: this.slotDatePart(appointment.timeSlot),
    };
  }
}
