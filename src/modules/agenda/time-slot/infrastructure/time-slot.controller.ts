import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { TimeSlotService } from '../application/services/time-slot.service';
import { CreateTimeSlotDto, UpdateTimeSlotDto } from '../application/dto/create-time-slot.dto';
import { UpdateTimeSlotCapacityDto } from '../application/dto/update-time-slot-capacity.dto';
import { ApiTags, ApiOperation, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../../../core/auth/decorators/roles.decorator';
import { ADMIN } from '../../../../core/auth/roles';
import { Public } from '../../../../core/auth/decorators/public.decorator';

@ApiTags('Time Slot')
@Controller('time-slot')
export class TimeSlotController {
  constructor(private readonly service: TimeSlotService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all time slots (with optional date and professionalId filtering)' })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'professionalId', required: false, type: String, description: 'Professional UUID' })
  @ApiQuery({ name: 'clinicId', required: false, type: String, description: 'Filter by clinic UUID' })
  findAll(@Query('date') date?: string, @Query('professionalId') professionalId?: string, @Query('clinicId') clinicId?: string) {
    if (date) {
      return this.service.findByDate(date, professionalId, clinicId);
    }
    return this.service.findAll(date, professionalId, clinicId);
  }

  @Public()
  @Get('by-date')
  @ApiOperation({ summary: 'Obtener únicamente los slots reales cargados para una fecha específica (YYYY-MM-DD)' })
  @ApiQuery({ name: 'date', required: true, description: 'Fecha en formato YYYY-MM-DD' })
  @ApiQuery({ name: 'professionalId', required: false, type: String, description: 'ID de profesional (opcional)' })
  @ApiQuery({ name: 'clinicId', required: false, type: String, description: 'Filtrar por clínica (UUID)' })
  findByDate(@Query('date') date: string, @Query('professionalId') professionalId?: string, @Query('clinicId') clinicId?: string) {
    return this.service.findByDate(date, professionalId, clinicId);
  }

  @Get('/slots')
  @Get('/api/slots')
  @ApiOperation({ summary: 'Alias para obtener slots por fecha (/slots o /api/slots)' })
  findSlotsAlias(@Query('date') date: string, @Query('professionalId') professionalId?: string, @Query('clinicId') clinicId?: string) {
    return this.service.findByDate(date, professionalId, clinicId);
  }

  @Roles(ADMIN)
  @Patch('capacity/global')
  @Put('capacity/global')
  @ApiOperation({ summary: 'Update maximum capacity (N) globally for all time slots in all agendas' })
  @ApiBody({ type: UpdateTimeSlotCapacityDto })
  updateGlobalCapacity(@Body() dto: UpdateTimeSlotCapacityDto) {
    return this.service.updateAllSlotsCapacity(dto.maxCapacity);
  }

  @Roles(ADMIN)
  @Patch('agenda/:agendaId/capacity')
  @Put('agenda/:agendaId/capacity')
  @ApiOperation({ summary: 'Update maximum capacity (N) for all slots in a daily agenda' })
  @ApiBody({ type: UpdateTimeSlotCapacityDto })
  updateAgendaSlotsCapacity(@Param('agendaId') agendaId: string, @Body() dto: UpdateTimeSlotCapacityDto) {
    return this.service.updateAgendaSlotsCapacity(agendaId, dto.maxCapacity);
  }

  @Roles(ADMIN)
  @Patch(':id/capacity')
  @Put(':id/capacity')
  @ApiOperation({ summary: 'Update maximum capacity (N) for a specific time slot' })
  @ApiBody({ type: UpdateTimeSlotCapacityDto })
  updateCapacity(@Param('id') id: string, @Body() dto: UpdateTimeSlotCapacityDto) {
    return this.service.update(id, { maxCapacity: dto.maxCapacity });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get time slot by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a new time slot' })
  @ApiBody({ type: CreateTimeSlotDto })
  create(@Body() dto: CreateTimeSlotDto) {
    return this.service.create(dto);
  }

  @Roles(ADMIN)
  @Put(':id')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a time slot' })
  @ApiBody({ type: UpdateTimeSlotDto })
  update(@Param('id') id: string, @Body() dto: UpdateTimeSlotDto) {
    return this.service.update(id, dto);
  }

  @Roles(ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a time slot' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}