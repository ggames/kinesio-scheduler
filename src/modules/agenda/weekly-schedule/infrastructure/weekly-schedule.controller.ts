import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { WeeklyScheduleService } from '../application/services/weekly-schedule.service';
import { CreateWeeklyScheduleDto, UpdateWeeklyScheduleDto } from '../application/dto/create-weekly-schedule.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Roles } from '../../../../core/auth/decorators/roles.decorator';
import { ADMIN, CLINIC_ADMIN, STAFF } from '../../../../core/auth/roles';

@ApiTags('Weekly Schedule')
@ApiBearerAuth()
@Controller('weekly-schedule')
export class WeeklyScheduleController {
  constructor(private readonly service: WeeklyScheduleService) {}

  @Get()
  @ApiOperation({ summary: 'Get all weekly schedules' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get weekly schedule by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Post()
  @ApiOperation({ summary: 'Create a new weekly schedule' })
  @ApiBody({ type: CreateWeeklyScheduleDto })
  create(@Body() dto: CreateWeeklyScheduleDto) {
    return this.service.create(dto);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Put(':id')
  @ApiOperation({ summary: 'Update a weekly schedule' })
  @ApiBody({ type: UpdateWeeklyScheduleDto })
  update(@Param('id') id: string, @Body() dto: UpdateWeeklyScheduleDto) {
    return this.service.update(id, dto);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a weekly schedule' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
