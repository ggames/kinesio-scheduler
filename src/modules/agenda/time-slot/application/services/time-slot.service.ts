import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, In, Not } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TimeSlot, TimeSlotStatus } from '../../domain/time-slot.entity';
import { CreateTimeSlotDto } from '../dto/create-time-slot.dto';
import { TimeSlotCapacityUpdatedEvent } from '../../../domain/events/time-slot-capacity-updated.event';
import { Appointment, AppointmentStatus } from '../../../../appointments/domain/appointment.entity';

@Injectable()
export class TimeSlotService {
  constructor(
    @InjectRepository(TimeSlot) private readonly repo: Repository<TimeSlot>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async syncSlot(slot: TimeSlot): Promise<TimeSlot> {
    if (!slot) return slot;
    const activeCount = await this.dataSource.getRepository(Appointment).count({
      where: {
        timeSlot: { id: slot.id },
        status: Not(
          In([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]),
        ),
      },
    });

    let updated = false;
    if (!slot.maxCapacity || slot.maxCapacity === 1) {
      slot.maxCapacity = 6;
      updated = true;
    }

    if (slot.currentBookings !== activeCount) {
      slot.currentBookings = activeCount;
      updated = true;
    }

    const remaining = slot.maxCapacity - slot.currentBookings;
    if (remaining > 0 && slot.status === TimeSlotStatus.BOOKED) {
      slot.status = TimeSlotStatus.AVAILABLE;
      updated = true;
    } else if (remaining <= 0 && slot.status === TimeSlotStatus.AVAILABLE) {
      slot.status = TimeSlotStatus.BOOKED;
      updated = true;
    }

    if (slot.agenda?.date) {
      const rawDate: any = slot.agenda.date;
      const datePart =
        typeof rawDate === 'string'
          ? rawDate.substring(0, 10)
          : rawDate instanceof Date
          ? rawDate.toISOString().split('T')[0]
          : null;

      if (datePart) {
        const endTimePart = slot.endTime.length === 5 ? slot.endTime + ':00' : slot.endTime;
        const slotEndDateTime = new Date(`${datePart}T${endTimePart}`);
        const now = new Date();

        if (slotEndDateTime.getTime() < now.getTime() && slot.status !== TimeSlotStatus.EXPIRED) {
          slot.status = TimeSlotStatus.EXPIRED;
          updated = true;
        }
      }
    }

    if (updated) {
      return this.repo.save(slot);
    }
    return slot;
  }

  async findAll(date?: string, professionalId?: string, clinicId?: string): Promise<TimeSlot[]> {
    const slots = await this.repo.find({
      relations: { agenda: true },
      order: { startTime: 'ASC' },
    });
    const synced = await Promise.all(slots.map((s) => this.syncSlot(s)));

    return synced.filter((slot) => {
      if (clinicId) {
        const slotClinicId =
          slot.doctorScheduleTemplate?.clinicId ??
          (slot.weeklySchedule?.clinic as any)?.id ??
          null;
        if (slotClinicId !== clinicId) {
          return false;
        }
      }
      if (professionalId && slot.agenda?.professionalId !== professionalId) {
        return false;
      }
      if (date && slot.agenda?.date) {
        const rawDate: any = slot.agenda.date;
        const datePart =
          typeof rawDate === 'string'
            ? rawDate.substring(0, 10)
            : rawDate instanceof Date
            ? rawDate.toISOString().split('T')[0]
            : String(rawDate).substring(0, 10);
        if (datePart !== date) {
          return false;
        }
      }
      return true;
    });
  }

  async findByDate(date: string, professionalId?: string, clinicId?: string): Promise<TimeSlot[]> {
    if (!date) return [];

    const dateStr = date.substring(0, 10);
    const qb = this.repo.createQueryBuilder('slot')
      .leftJoinAndSelect('slot.agenda', 'agenda')
      .where("date(agenda.date) = date(:dateStr)", { dateStr })
      .orderBy('slot.startTime', 'ASC');

    if (professionalId) {
      qb.andWhere('agenda.professionalId = :professionalId', { professionalId });
    }

    const slots = await qb.getMany();

    // Filter by clinicId in memory (DailyAgenda doesn't have clinicId directly;
    // it's on WeeklySchedule/DoctorScheduleTemplate which may or may not be linked)
    const filtered = clinicId
      ? slots.filter((slot) => {
          const slotClinicId =
            slot.doctorScheduleTemplate?.clinicId ??
            (slot.weeklySchedule?.clinic as any)?.id ??
            null;
          return slotClinicId === clinicId;
        })
      : slots;

    // Fallback si date() en SQL difiere por zona horaria en la DB
    if (filtered.length === 0 || clinicId) {
      const allSlots = await this.repo.find({ relations: { agenda: true }, order: { startTime: 'ASC' } });
      const filteredAll = allSlots.filter((slot) => {
        if (!slot.agenda?.date) return false;
        const rawDate: any = slot.agenda.date;
        const dStr = typeof rawDate === 'string'
          ? rawDate.substring(0, 10)
          : rawDate instanceof Date
          ? rawDate.toISOString().split('T')[0]
          : String(rawDate).substring(0, 10);
        if (dStr !== dateStr) return false;
        if (clinicId) {
          const slotClinicId =
            slot.doctorScheduleTemplate?.clinicId ??
            (slot.weeklySchedule?.clinic as any)?.id ??
            null;
          if (slotClinicId !== clinicId) {
            return false;
          }
        }
        if (professionalId && slot.agenda?.professionalId !== professionalId) return false;
        return true;
      });
      return Promise.all(filteredAll.map((s) => this.syncSlot(s)));
    }

    return Promise.all(filtered.map((s) => this.syncSlot(s)));
  }

  async findOne(id: string): Promise<TimeSlot> {
    if (id === 'by-date' || id === 'by-date/') {
      throw new NotFoundException(`Parámetro de ruta 'by-date' no es un ID válido`);
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let entity: TimeSlot | null = null;

    if (isUuid) {
      entity = await this.repo.findOne({ where: { id }, relations: { agenda: true } });
    }

    if (!entity) {
      const conditions: any[] = [{ startTime: id }];
      if (isUuid) {
        conditions.push({ agendaId: id });
      }
      entity = await this.repo.findOne({
        where: conditions,
        relations: { agenda: true },
      });
    }

    if (!entity) throw new NotFoundException(`TimeSlot con ID o parámetro ${id} no encontrado`);
    return this.syncSlot(entity);
  }

  async create(dto: CreateTimeSlotDto): Promise<TimeSlot> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  /**
   * Actualiza un slot existente incluyendo validación defensiva de capacidad (N).
   */
  async update(id: string, dto: Partial<CreateTimeSlotDto>): Promise<TimeSlot> {
    const entity = await this.findOne(id);

    if (dto.maxCapacity !== undefined) {
      if (dto.maxCapacity < entity.currentBookings) {
        throw new BadRequestException(
          `La capacidad máxima (${dto.maxCapacity}) no puede ser menor a las reservas activas actualizadas (${entity.currentBookings}).`,
        );
      }
      entity.maxCapacity = dto.maxCapacity;

      const remaining = entity.maxCapacity - entity.currentBookings;
      if (remaining <= 0) {
        entity.status = TimeSlotStatus.BOOKED;
      } else if (entity.status === TimeSlotStatus.BOOKED) {
        entity.status = TimeSlotStatus.AVAILABLE;
      }
    }

    if (dto.startTime) entity.startTime = dto.startTime;
    if (dto.endTime) entity.endTime = dto.endTime;
    if (dto.agendaId) entity.agendaId = dto.agendaId;

    const saved = await this.repo.save(entity);

    const remaining = saved.maxCapacity - saved.currentBookings;
    this.eventEmitter.emit(
      'slot.capacity.updated',
      new TimeSlotCapacityUpdatedEvent(
        saved.id,
        Math.max(0, remaining),
        saved.status,
      ),
    );

    return saved;
  }

  /**
   * Actualización masiva de la capacidad (N) para todos los slots de una agenda diaria.
   */
  async updateAgendaSlotsCapacity(agendaId: string, maxCapacity: number): Promise<TimeSlot[]> {
    const slots = await this.repo.find({ where: { agendaId } });
    if (!slots || slots.length === 0) {
      throw new NotFoundException(`No se encontraron slots para la agenda ${agendaId}`);
    }

    // Validación defensiva masiva previa
    const conflicto = slots.find((s) => maxCapacity < s.currentBookings);
    if (conflicto) {
      throw new BadRequestException(
        `No se puede aplicar capacidad (${maxCapacity}) porque el slot ${conflicto.startTime} - ${conflicto.endTime} posee ${conflicto.currentBookings} reservas activas.`,
      );
    }

    const actualizados: TimeSlot[] = [];
    for (const slot of slots) {
      slot.maxCapacity = maxCapacity;
      const remaining = slot.maxCapacity - slot.currentBookings;
      if (remaining <= 0) {
        slot.status = TimeSlotStatus.BOOKED;
      } else if (slot.status === TimeSlotStatus.BOOKED) {
        slot.status = TimeSlotStatus.AVAILABLE;
      }

      const guardado = await this.repo.save(slot);
      actualizados.push(guardado);

      this.eventEmitter.emit(
        'slot.capacity.updated',
        new TimeSlotCapacityUpdatedEvent(
          guardado.id,
          Math.max(0, remaining),
          guardado.status,
        ),
      );
    }

    return actualizados;
  }

  /**
   * Actualización global de la capacidad (N) para TODOS los slots de todas las agendas.
   */
  async updateAllSlotsCapacity(maxCapacity: number): Promise<TimeSlot[]> {
    const slots = await this.repo.find();
    if (!slots || slots.length === 0) {
      return [];
    }

    const conflicto = slots.find((s) => maxCapacity < s.currentBookings);
    if (conflicto) {
      throw new BadRequestException(
        `No se puede aplicar capacidad (${maxCapacity}) porque un slot de la agenda posee ${conflicto.currentBookings} reservas activas.`,
      );
    }

    const actualizados: TimeSlot[] = [];
    for (const slot of slots) {
      slot.maxCapacity = maxCapacity;
      const remaining = slot.maxCapacity - slot.currentBookings;
      if (remaining <= 0) {
        slot.status = TimeSlotStatus.BOOKED;
      } else if (slot.status === TimeSlotStatus.BOOKED) {
        slot.status = TimeSlotStatus.AVAILABLE;
      }

      const guardado = await this.repo.save(slot);
      actualizados.push(guardado);

      this.eventEmitter.emit(
        'slot.capacity.updated',
        new TimeSlotCapacityUpdatedEvent(
          guardado.id,
          Math.max(0, remaining),
          guardado.status,
        ),
      );
    }

    return actualizados;
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
