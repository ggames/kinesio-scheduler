import { Controller, Post, Get, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { HealthInsurancesService } from '../application/health-insurances.service';
import {
  CreateHealthInsuranceDto,
  UpdateHealthInsuranceDto,
} from '../application/dto/create-health-insurance.dto';
import { PaginationQueryDto } from '../../../core/http/dto/pagination-query.dto';
import { ApiTags, ApiOperation, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { ADMIN } from '../../../core/auth/roles';
import { Public } from '../../../core/auth/decorators/public.decorator';

@ApiTags('Health Insurances')
@Controller('health-insurances')
export class HealthInsurancesController {
  constructor(private readonly service: HealthInsurancesService) {}

  @Roles(ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create health insurance' })
  @ApiBody({ type: CreateHealthInsuranceDto })
  create(@Body() dto: CreateHealthInsuranceDto) {
    return this.service.create(dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List health insurances (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a health insurance by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a health insurance' })
  @ApiBody({ type: UpdateHealthInsuranceDto })
  update(@Param('id') id: string, @Body() dto: UpdateHealthInsuranceDto) {
    return this.service.update(id, dto);
  }

  @Roles(ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a health insurance if unused' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
