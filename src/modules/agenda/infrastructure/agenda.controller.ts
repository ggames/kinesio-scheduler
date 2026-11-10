import { Controller, Post, Get, Put, Patch, Param, Body } from '@nestjs/common';
import { AgendaService } from '../application/agenda.service';
import { CalendarGeneratorService } from '../application/services/calendar-generator.service';
import { TimeSlotService } from '../time-slot/application/services/time-slot.service';
import { CreateDailyAgendaDto } from '../application/dto/create-daily-agenda.dto';
import { UpdateTimeSlotCapacityDto } from '../time-slot/application/dto/update-time-slot-capacity.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { CreateWeeklyScheduleDto } from '../application/dto/create-weekly-schedule.dto';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { ADMIN, CLINIC_ADMIN, STAFF } from '../../../core/auth/roles';

@ApiTags('Agenda')
@ApiBearerAuth()
@Controller('agenda')
export class AgendaController {
  constructor(
    private readonly service: AgendaService,
    private readonly calendarGeneratorService: CalendarGeneratorService,
    private readonly timeSlotService: TimeSlotService,
  ) {}

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Post('generate-rolling-window')
  @ApiOperation({ summary: 'Disparo manual para generar o actualizar la agenda deslizante de 2 meses (60 días)' })
  generateRollingWindow() {
    return this.calendarGeneratorService.generateRollingWindowFor60Days();
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Post('professionals/:professionalId/generate')
  @ApiOperation({ summary: 'Disparo manual para generar la agenda de 2 meses de un profesional específico' })
  generateForProfessional(@Param('professionalId') professionalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 59, 0, 0, 0, 0);
    return this.calendarGeneratorService.generateScheduleForProfessionalInRange(professionalId, today, endDate);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Patch('capacity/global')
  @Put('capacity/global')
  @ApiOperation({ summary: 'Update maximum capacity (N) globally for all time slots' })
  @ApiBody({ type: UpdateTimeSlotCapacityDto })
  updateGlobalCapacity(@Body() dto: UpdateTimeSlotCapacityDto) {
    return this.timeSlotService.updateAllSlotsCapacity(dto.maxCapacity);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Patch(':agendaId/capacity')
  @Put(':agendaId/capacity')
  @ApiOperation({ summary: 'Update maximum capacity (N) for all slots in a daily agenda' })
  @ApiBody({ type: UpdateTimeSlotCapacityDto })
  updateAgendaCapacity(@Param('agendaId') agendaId: string, @Body() dto: UpdateTimeSlotCapacityDto) {
    return this.timeSlotService.updateAgendaSlotsCapacity(agendaId, dto.maxCapacity);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Patch('slots/:slotId/capacity')
  @Put('slots/:slotId/capacity')
  @ApiOperation({ summary: 'Update maximum capacity (N) for a specific time slot' })
  @ApiBody({ type: UpdateTimeSlotCapacityDto })
  updateSlotCapacity(@Param('slotId') slotId: string, @Body() dto: UpdateTimeSlotCapacityDto) {
    return this.timeSlotService.update(slotId, { maxCapacity: dto.maxCapacity });
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Post()
  @ApiOperation({ summary: 'Create daily agenda and auto-generate hourly time slots' })
  @ApiBody({ type: CreateDailyAgendaDto })
  createDailyAgenda(@Body() dto: CreateDailyAgendaDto) {
    return this.service.createDailyAgendaWithSlots(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all daily agendas' })
  findAllAgendas() {
    return this.service.findAllAgendas();
  }

  @Get(':agendaId/slots')
  @ApiOperation({ summary: 'Get time slots for a specific agenda' })
  findTimeSlots(@Param('agendaId') agendaId: string) {
    return this.service.findTimeSlots(agendaId);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Post('clinics/:clinicId/weekly-schedule/bulk')
  @ApiOperation({ summary: 'Bulk create or update weekly schedules for a clinic' })
  @ApiBody({ type: [CreateWeeklyScheduleDto] })
  bulkUpsertWeeklySchedules(@Param('clinicId') clinicId: string, @Body() dtos: CreateWeeklyScheduleDto[]) {
    return this.service.bulkUpsertWeeklySchedules(clinicId, dtos);
  }
}
