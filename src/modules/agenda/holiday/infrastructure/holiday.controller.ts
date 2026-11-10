import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { HolidayService } from '../application/services/holiday.service';
import { CreateHolidayDto, UpdateHolidayDto } from '../application/dto/create-holiday.dto';
import { ApiTags, ApiOperation, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../../../core/auth/decorators/roles.decorator';
import { ADMIN } from '../../../../core/auth/roles';
import { Public } from '../../../../core/auth/decorators/public.decorator';
import { PaginationQueryDto } from '../../../../core/http/dto/pagination-query.dto';

@ApiTags('Holiday')
@Controller('holiday')
export class HolidayController {
  constructor(private readonly service: HolidayService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List holidays (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'clinicId', required: false, type: String, description: 'Filter by clinic UUID' })
  findAll(@Query() query: PaginationQueryDto & { clinicId?: string }) {
    return this.service.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get holiday by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a new holiday' })
  @ApiBody({ type: CreateHolidayDto })
  create(@Body() dto: CreateHolidayDto) {
    return this.service.create(dto);
  }

  @Roles(ADMIN)
  @Put(':id')
  @ApiOperation({ summary: 'Update a holiday' })
  @ApiBody({ type: UpdateHolidayDto })
  update(@Param('id') id: string, @Body() dto: UpdateHolidayDto) {
    return this.service.update(id, dto);
  }

  @Roles(ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a holiday' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
