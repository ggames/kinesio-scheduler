import { Controller, Get, Delete, Param } from '@nestjs/common';
import { DailyAgendaService } from '../application/services/daily-agenda.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../../../core/auth/decorators/roles.decorator';
import { ADMIN, CLINIC_ADMIN, STAFF } from '../../../../core/auth/roles';

@ApiTags('Daily Agenda')
@ApiBearerAuth()
@Controller('daily-agenda')
export class DailyAgendaController {
  constructor(private readonly service: DailyAgendaService) {}

  @Get()
  @ApiOperation({ summary: 'Get all daily agendas' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get daily agenda by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a daily agenda' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
