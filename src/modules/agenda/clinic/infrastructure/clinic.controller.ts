import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ClinicService } from '../application/services/clinic.service';
import { CreateClinicDto, UpdateClinicDto } from '../application/dto/create-clinic.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Roles } from '../../../../core/auth/decorators/roles.decorator';
import { ADMIN, CLINIC_ADMIN } from '../../../../core/auth/roles';
import { PaginationQueryDto } from '../../../../core/http/dto/pagination-query.dto';

@ApiTags('Clinic')
@ApiBearerAuth()
@Controller('clinic')
export class ClinicController {
  constructor(private readonly service: ClinicService) {}

  @Get()
  @ApiOperation({ summary: 'List clinics (paginated)' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get clinic by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a new clinic' })
  @ApiBody({ type: CreateClinicDto })
  create(@Body() dto: CreateClinicDto) {
    return this.service.create(dto);
  }

  @Roles(ADMIN, CLINIC_ADMIN)
  @Put(':id')
  @ApiOperation({ summary: 'Update a clinic' })
  @ApiBody({ type: UpdateClinicDto })
  update(@Param('id') id: string, @Body() dto: UpdateClinicDto) {
    return this.service.update(id, dto);
  }

  @Roles(ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a clinic' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
