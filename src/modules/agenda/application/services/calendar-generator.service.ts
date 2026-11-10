import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CronLockService } from '../../../../core/scheduling/cron-lock.service';
import { DoctorScheduleTemplate } from '../../doctor-schedule-template/domain/doctor-schedule-template.entity';
import { DailyAgenda } from '../../daily-agenda/domain/daily-agenda.entity';
import { TimeSlot, TimeSlotStatus } from '../../time-slot/domain/time-slot.entity';
import { Holiday, HolidayType } from '../../holiday/domain/holiday.entity';
import { Professional } from '../../../professionals/domain/professional.entity';
import { Clinic } from '../../clinic/domain/clinic.entity';
import { WeeklySchedule } from '../../weekly-schedule/domain/weekly-schedule.entity';

/** Resumen de métricas tras la ejecución del generador */
export interface CalendarGenerationResult {
  professionalsProcessed: number;
  agendasCreated: number;
  timeSlotsCreated: number;
  daysSkippedForHolidays: number;
  startDate: string;
  endDate: string;
}

@Injectable()
export class CalendarGeneratorService implements OnModuleInit {
  private readonly logger = new Logger(CalendarGeneratorService.name);

  constructor(
    @InjectRepository(DoctorScheduleTemplate)
    private readonly templateRepo: Repository<DoctorScheduleTemplate>,
    @InjectRepository(DailyAgenda)
    private readonly agendaRepo: Repository<DailyAgenda>,
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepo: Repository<TimeSlot>,
    @InjectRepository(Holiday)
    private readonly holidayRepo: Repository<Holiday>,
    @InjectRepository(Professional)
    private readonly professionalRepo: Repository<Professional>,
    @InjectRepository(Clinic)
    private readonly clinicRepo: Repository<Clinic>,
    @InjectRepository(WeeklySchedule)
    private readonly weeklyScheduleRepo: Repository<WeeklySchedule>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Optional()
    private readonly cronLock?: CronLockService,
  ) {}

  /**
   * Al iniciar el módulo, si faltan clínicas, plantillas o agendas de 2 meses (60 días),
   * las crea automáticamente para garantizar la disponibilidad inmediata del sistema.
   */
  async onModuleInit() {
    this.logger.log('Initializing CalendarGeneratorService: checking seed templates and 2-month rolling window...');
    try {
      await this.ensureSeedTemplatesAndClinics();
      const result = await this.generateRollingWindowFor60Days();
      this.logger.log(
        `Automatic 2-month agenda generation complete: ${result.agendasCreated} agendas and ${result.timeSlotsCreated} slots created for ${result.professionalsProcessed} professionals.`,
      );
    } catch (err) {
      this.logger.error(`Error during initial 2-month agenda auto-generation: ${(err as Error).message}`);
    }
  }

  /**
   * Garantiza la existencia de al menos una clínica, plantillas semanales globales y plantillas por médico.
   */
  async ensureSeedTemplatesAndClinics(): Promise<{ clinic: Clinic; templatesCreated: number }> {
    let clinic = await this.clinicRepo.findOne({ where: {} });
    if (!clinic) {
      this.logger.log('No clinic found. Creating default clinic "Clínica Central de Kinesiología"...');
      clinic = this.clinicRepo.create({
        name: 'Clínica Central de Kinesiología',
      });
      clinic = await this.clinicRepo.save(clinic);
    }

    const weeklyScheduleCount = await this.weeklyScheduleRepo.count();
    if (weeklyScheduleCount === 0) {
      this.logger.log('Seeding default weekly schedules (Mon-Fri 08:00-18:00) for clinic...');
      const weeklySchedules: WeeklySchedule[] = [];
      for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
        weeklySchedules.push(
          this.weeklyScheduleRepo.create({
            clinic,
            dayOfWeek,
            startTime: '08:00:00',
            endTime: '18:00:00',
            slotDurationMinutes: 60,
            maxCapacityPerSlot: 6,
          }),
        );
      }
      await this.weeklyScheduleRepo.save(weeklySchedules);
    }

    const professionals = await this.professionalRepo.find();
    let templatesCreated = 0;

    for (const prof of professionals) {
      const existingTemplates = await this.templateRepo.count({ where: { professionalId: prof.id } });
      if (existingTemplates === 0) {
        this.logger.log(`Seeding default schedule template (Mon-Fri 08:00-18:00) for professional ${prof.id}...`);
        const defaultTemplates: DoctorScheduleTemplate[] = [];
        for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
          defaultTemplates.push(
            this.templateRepo.create({
              professionalId: prof.id,
              clinicId: clinic.id,
              dayOfWeek,
              startTime: '08:00:00',
              endTime: '18:00:00',
              slotDurationMinutes: 60,
              maxCapacityPerSlot: 6,
            }),
          );
        }
        await this.templateRepo.save(defaultTemplates);
        templatesCreated += defaultTemplates.length;
      }
    }

    return { clinic, templatesCreated };
  }

  /**
   * Cron Job programado para ejecutarse diariamente a medianoche (00:00).
   * Mantiene el horizonte de disponibilidad a exactamente 60 días (2 meses) hacia el futuro.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyRollingWindowCron(): Promise<CalendarGenerationResult | null> {
    this.logger.log('Starting daily 60-day (2-month) rolling window calendar generation job...');
    let result: CalendarGenerationResult | null = null;
    if (this.cronLock) {
      const executed = await this.cronLock.runWithLock(
        'calendar.daily_rolling_window',
        30 * 60 * 1000,
        async () => {
          result = await this.generateRollingWindowFor60Days();
        },
      );
      if (!executed) {
        this.logger.debug(
          'Generación de calendario omitida en esta instancia: lock activo en otra réplica.',
        );
        return null;
      }
    } else {
      result = await this.generateRollingWindowFor60Days();
    }

    if (result) {
      this.logger.log(
        `Completed cron calendar generation: ${result.agendasCreated} agendas and ${result.timeSlotsCreated} slots created for ${result.professionalsProcessed} professionals.`,
      );
    }
    return result;
  }

  /**
   * Genera la agenda deslizante de 60 días (2 meses) para todos los profesionales.
   */
  async generateRollingWindowFor60Days(
    customStartDate?: Date,
    daysAhead: number = 60,
  ): Promise<CalendarGenerationResult> {
    const today = customStartDate ? new Date(customStartDate) : new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysAhead - 1, 0, 0, 0, 0);

    const yyyyStart = today.getFullYear();
    const mmStart = String(today.getMonth() + 1).padStart(2, '0');
    const ddStart = String(today.getDate()).padStart(2, '0');
    const startDateStr = `${yyyyStart}-${mmStart}-${ddStart}`;

    const yyyyEnd = endDate.getFullYear();
    const mmEnd = String(endDate.getMonth() + 1).padStart(2, '0');
    const ddEnd = String(endDate.getDate()).padStart(2, '0');
    const endDateStr = `${yyyyEnd}-${mmEnd}-${ddEnd}`;

    const professionals = await this.professionalRepo.find();
    let agendasCreated = 0;
    let timeSlotsCreated = 0;
    let daysSkippedForHolidays = 0;

    for (const prof of professionals) {
      const res = await this.generateScheduleForProfessionalInRange(
        prof.id,
        today,
        endDate,
      );
      agendasCreated += res.agendasCreated;
      timeSlotsCreated += res.timeSlotsCreated;
      daysSkippedForHolidays += res.daysSkippedForHolidays;
    }

    return {
      professionalsProcessed: professionals.length,
      agendasCreated,
      timeSlotsCreated,
      daysSkippedForHolidays,
      startDate: startDateStr,
      endDate: endDateStr,
    };
  }

  /** Alias para compatibilidad con código existente que utiliza 8 semanas */
  async generateRollingWindowFor8Weeks(
    customStartDate?: Date,
    weeksAhead: number = 8,
  ): Promise<CalendarGenerationResult> {
    return this.generateRollingWindowFor60Days(customStartDate, weeksAhead * 7);
  }

  /**
   * Genera agendas y slots para un profesional en un rango de fechas.
   * Utiliza un mapa en memoria de agendas existentes para evitar errores de colisión por formato de fecha.
   */
  async generateScheduleForProfessionalInRange(
    professionalId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ agendasCreated: number; timeSlotsCreated: number; daysSkippedForHolidays: number }> {
    // Cargar plantillas de horarios semanales del profesional
    let templates = await this.templateRepo.find({
      where: { professionalId },
    });

    if (templates.length === 0) {
      const defaultTemplates: DoctorScheduleTemplate[] = [];
      for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
        defaultTemplates.push(
          this.templateRepo.create({
            professionalId,
            dayOfWeek,
            startTime: '08:00:00',
            endTime: '18:00:00',
            slotDurationMinutes: 60,
            maxCapacityPerSlot: 6,
          }),
        );
      }
      templates = await this.templateRepo.save(defaultTemplates);
    }

    // Cargar feriados en el rango de fechas
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const startDateNum = startDate.getDate();

    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth();
    const endDateNum = endDate.getDate();

    const startStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDateNum).padStart(2, '0')}`;
    const endStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDateNum).padStart(2, '0')}`;

    const holidays = await this.holidayRepo.find();
    const holidayMap = new Map<string, Holiday>();
    for (const h of holidays) {
      if (h.date >= startStr && h.date <= endStr) {
        holidayMap.set(h.date, h);
      }
    }

    // Cargar agendas existentes del profesional para mapa seguro en memoria
    const existingAgendas = await this.agendaRepo.find({
      where: { professionalId },
    });
    const agendaMap = new Map<string, DailyAgenda>();
    for (const a of existingAgendas) {
      let dStr = '';
      if (a.date instanceof Date) {
        const y = a.date.getFullYear();
        const m = String(a.date.getMonth() + 1).padStart(2, '0');
        const d = String(a.date.getDate()).padStart(2, '0');
        dStr = `${y}-${m}-${d}`;
      } else {
        dStr = String(a.date).substring(0, 10);
      }
      agendaMap.set(dStr, a);
    }

    let agendasCreated = 0;
    let timeSlotsCreated = 0;
    let daysSkippedForHolidays = 0;

    const startObj = new Date(startYear, startMonth, startDateNum, 0, 0, 0, 0);
    const endObj = new Date(endYear, endMonth, endDateNum, 0, 0, 0, 0);

    const diffDays = Math.ceil((endObj.getTime() - startObj.getTime()) / (1000 * 3600 * 24)) + 1;

    for (let dayIdx = 0; dayIdx < diffDays; dayIdx++) {
      const curr = new Date(startYear, startMonth, startDateNum + dayIdx, 0, 0, 0, 0);
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, '0');
      const dd = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const jsDay = curr.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
      const isoWeekday = jsDay === 0 ? 7 : jsDay; // 1 = Mon ... 7 = Sun

      // Buscar si el profesional atiende este día de la semana
      const matchingTemplates = templates.filter((t) => t.dayOfWeek === isoWeekday);

      if (matchingTemplates.length > 0) {
        const holiday = holidayMap.get(dateStr);

        // Si es feriado TOTAL, omitir creación de slots para este día
        if (holiday && holiday.type === HolidayType.TOTAL) {
          daysSkippedForHolidays++;
        } else {
          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            let agenda = agendaMap.get(dateStr);

            if (!agenda) {
              const dateVal = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate(), 0, 0, 0, 0);
              agenda = queryRunner.manager.create(DailyAgenda, {
                professionalId,
                date: dateVal,
              });
              agenda = await queryRunner.manager.save(DailyAgenda, agenda);
              agendaMap.set(dateStr, agenda);
              agendasCreated++;
            }

            // Generar franjas horarias (slots) según las plantillas
            for (const tpl of matchingTemplates) {
              const created = await this.generateSlotsFromTemplate(
                queryRunner.manager,
                agenda,
                tpl,
                holiday,
              );
              timeSlotsCreated += created;
            }

            await queryRunner.commitTransaction();
          } catch (err) {
            await queryRunner.rollbackTransaction();
            const errorMessage = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `Error generating slots for professional ${professionalId} on ${dateStr}: ${errorMessage}`,
            );
          } finally {
            await queryRunner.release();
          }
        }
      }
    }

    return { agendasCreated, timeSlotsCreated, daysSkippedForHolidays };
  }

  /**
   * Genera los TimeSlots individuales dentro de un día según la plantilla del médico y feriados parciales.
   */
  private async generateSlotsFromTemplate(
    manager: any,
    agenda: DailyAgenda,
    template: DoctorScheduleTemplate,
    holiday?: Holiday,
  ): Promise<number> {
    const slotDuration = template.slotDurationMinutes || 60;
    const startHourMin = this.parseTimeStringToMinutes(template.startTime);
    const endHourMin = this.parseTimeStringToMinutes(template.endTime);

    let createdCount = 0;

    for (let min = startHourMin; min + slotDuration <= endHourMin; min += slotDuration) {
      const slotStartTime = this.formatMinutesToTimeString(min);
      const slotEndTime = this.formatMinutesToTimeString(min + slotDuration);

      // Si existe feriado parcial que bloquee esta hora específica, marcar como BLOCKED
      let isBlockedByHoliday = false;
      if (holiday && holiday.type === HolidayType.PARTIAL && holiday.partialStartTime && holiday.partialEndTime) {
        const hStart = this.parseTimeStringToMinutes(holiday.partialStartTime);
        const hEnd = this.parseTimeStringToMinutes(holiday.partialEndTime);
        if (min >= hStart && min < hEnd) {
          isBlockedByHoliday = true;
        }
      }

      // Verificar si el slot ya existe para garantizar idempotencia estricta
      const existingSlot = await manager.findOne(TimeSlot, {
        where: { agendaId: agenda.id, startTime: slotStartTime },
      });

      if (!existingSlot) {
        const newSlot = manager.create(TimeSlot, {
          agendaId: agenda.id,
          doctorScheduleTemplate: template,
          startTime: slotStartTime,
          endTime: slotEndTime,
          maxCapacity: template.maxCapacityPerSlot || 6,
          currentBookings: 0,
          status: isBlockedByHoliday ? TimeSlotStatus.BLOCKED : TimeSlotStatus.AVAILABLE,
        });

        await manager.save(TimeSlot, newSlot);
        createdCount++;
      }
    }

    return createdCount;
  }

  private parseTimeStringToMinutes(timeStr: string): number {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  }

  private formatMinutesToTimeString(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  }
}
