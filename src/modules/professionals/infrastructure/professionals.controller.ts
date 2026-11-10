import { Controller, Post, Get, Patch, Param, Body, Query } from '@nestjs/common';
import { ProfessionalsService } from '../application/professionals.service';
import { CreateProfessionalDto } from '../application/dto/create-professional.dto';
import { UpdateProfessionalDto } from '../application/dto/update-professional.dto';
import { PaginationQueryDto } from '../../../core/http/dto/pagination-query.dto';
import { ApiTags, ApiOperation, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { ADMIN } from '../../../core/auth/roles';
import { Public } from '../../../core/auth/decorators/public.decorator';

@ApiTags('Professionals')
@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly service: ProfessionalsService) {}

  @Roles(ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a new professional' })
  @ApiBody({ type: CreateProfessionalDto })
  create(@Body() dto: CreateProfessionalDto) {
    return this.service.create(dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List professionals (paginated, searchable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'clinicId', required: false, type: String, description: 'Filter by clinic UUID' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  findAll(@Query() query: PaginationQueryDto & { clinicId?: string; includeInactive?: boolean }) {
    return this.service.findAll(query, String(query.includeInactive) === 'true');
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get professional by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a professional' })
  @ApiBody({ type: UpdateProfessionalDto })
  update(@Param('id') id: string, @Body() dto: UpdateProfessionalDto) {
    return this.service.update(id, dto);
  }

  @Roles(ADMIN)
  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a professional' })
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }

  @Roles(ADMIN)
  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate a professional' })
  reactivate(@Param('id') id: string) {
    return this.service.reactivate(id);
  }
}
