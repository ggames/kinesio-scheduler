import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyAgenda } from '../daily-agenda/domain/daily-agenda.entity';
import { TimeSlot } from '../time-slot/domain/time-slot.entity';
import { WeeklySchedule } from '../weekly-schedule/domain/weekly-schedule.entity';
import { Holiday } from '../holiday/domain/holiday.entity';
import { Clinic } from '../clinic/domain/clinic.entity';
import { CreateDailyAgendaDto } from './dto/create-daily-agenda.dto';
import { CreateWeeklyScheduleDto } from './dto/create-weekly-schedule.dto';

@Injectable()
export class AgendaService {
  constructor(
    @InjectRepository(DailyAgenda)
    private readonly agendaRepo: Repository<DailyAgenda>,
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepo: Repository<TimeSlot>,
    @InjectRepository(WeeklySchedule)
    private readonly weeklyScheduleRepo: Repository<WeeklySchedule>,
    @InjectRepository(Holiday)
    private readonly holidayRepo: Repository<Holiday>,
    @InjectRepository(Clinic)
    private readonly clinicRepo: Repository<Clinic>,
  ) {}

  async createDailyAgendaWithSlots(dto: CreateDailyAgendaDto): Promise<DailyAgenda> {
    const existing = await this.agendaRepo.findOne({
      where: {
        professional: { id: dto.professionalId },
        date: new Date(dto.date),
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Agenda already exists for this professional on this date',
      );
    }

    const agenda = this.agendaRepo.create({
      professional: { id: dto.professionalId } as any,
      date: new Date(dto.date),
    });
    const savedAgenda = await this.agendaRepo.save(agenda);

    const start = dto.startHour ?? 8;
    const end = dto.endHour ?? 18;

    const slots: TimeSlot[] = [];
    for (let i = start; i < end; i++) {
      slots.push(
        this.timeSlotRepo.create({
          agenda: { id: savedAgenda.id } as DailyAgenda,
          startTime: `${String(i).padStart(2, '0')}:00:00`,
          endTime: `${String(i + 1).padStart(2, '0')}:00:00`,
          maxCapacity: dto.maxCapacity ?? 6,
          currentBookings: 0,
          status: 'AVAILABLE',
        }),
      );
    }
    await this.timeSlotRepo.save(slots);
    return savedAgenda;
  }

  findAllAgendas(): Promise<DailyAgenda[]> {
    return this.agendaRepo.find({
      relations: {
        professional: true,
        slots: true,
      },
    });
  }

  findTimeSlots(agendaId: string): Promise<TimeSlot[]> {
    return this.timeSlotRepo.find({
      where: { agenda: { id: agendaId } },
      relations: { agenda: true },
      order: { startTime: 'ASC' },
    });
  }

  async bulkUpsertWeeklySchedules(
    clinicId: string,
    dtos: CreateWeeklyScheduleDto[],
  ): Promise<WeeklySchedule[]> {
    const clinic = await this.clinicRepo.findOne({ where: { id: clinicId } });
    if (!clinic) {
      throw new BadRequestException('Clinic not found');
    }

    const results: WeeklySchedule[] = [];
    for (const dto of dtos) {
      let schedule = await this.weeklyScheduleRepo.findOne({
        where: { clinic: { id: clinicId }, dayOfWeek: dto.dayOfWeek },
      });
      if (!schedule) {
        schedule = this.weeklyScheduleRepo.create({
          clinic,
          dayOfWeek: dto.dayOfWeek,
          startTime: dto.startTime,
          endTime: dto.endTime,
          slotDurationMinutes: dto.slotDurationMinutes ?? 60,
          maxCapacityPerSlot: dto.maxCapacityPerSlot ?? 1,
        });
      } else {
        schedule.startTime = dto.startTime;
        schedule.endTime = dto.endTime;
        schedule.slotDurationMinutes = dto.slotDurationMinutes ?? 60;
        schedule.maxCapacityPerSlot =
          dto.maxCapacityPerSlot ?? schedule.maxCapacityPerSlot;
      }
      results.push(await this.weeklyScheduleRepo.save(schedule));
    }
    return results;
  }
}
