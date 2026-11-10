import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Domain entities
import { Clinic } from './clinic/domain/clinic.entity';
import { Holiday } from './holiday/domain/holiday.entity';
import { DailyAgenda } from './daily-agenda/domain/daily-agenda.entity';
import { TimeSlot } from './time-slot/domain/time-slot.entity';
import { WeeklySchedule } from './weekly-schedule/domain/weekly-schedule.entity';
import { DoctorScheduleTemplate } from './doctor-schedule-template/domain/doctor-schedule-template.entity';

// Services
import { AgendaService } from './application/agenda.service';
import { ClinicService } from './clinic/application/services/clinic.service';
import { HolidayService } from './holiday/application/services/holiday.service';
import { DailyAgendaService } from './daily-agenda/application/services/daily-agenda.service';
import { TimeSlotService } from './time-slot/application/services/time-slot.service';
import { WeeklyScheduleService } from './weekly-schedule/application/services/weekly-schedule.service';
import { CalendarGeneratorService } from './application/services/calendar-generator.service';

// Controllers
import { AgendaController } from './infrastructure/agenda.controller';
import { ClinicController } from './clinic/infrastructure/clinic.controller';
import { HolidayController } from './holiday/infrastructure/holiday.controller';
import { DailyAgendaController } from './daily-agenda/infrastructure/daily-agenda.controller';
import { TimeSlotController } from './time-slot/infrastructure/time-slot.controller';
import { WeeklyScheduleController } from './weekly-schedule/infrastructure/weekly-schedule.controller';

// Sub-modules
import { PatientsModule } from '../patients/patients.module';
import { ProfessionalsModule } from '../professionals/professionals.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Clinic,
      Holiday,
      DailyAgenda,
      TimeSlot,
      WeeklySchedule,
      DoctorScheduleTemplate,
    ]),
    PatientsModule,
    ProfessionalsModule,
  ],
  controllers: [
    AgendaController,
    ClinicController,
    HolidayController,
    DailyAgendaController,
    TimeSlotController,
    WeeklyScheduleController,
  ],
  providers: [
    AgendaService,
    ClinicService,
    HolidayService,
    DailyAgendaService,
    TimeSlotService,
    WeeklyScheduleService,
    CalendarGeneratorService,
  ],
  exports: [TypeOrmModule, AgendaService, CalendarGeneratorService],
})
export class AgendaModule {}
