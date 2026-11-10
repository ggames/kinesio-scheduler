import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { PatientsService } from '../application/patients.service';
import { CreatePatientDto } from '../application/dto/create-patient.dto';
import { UpdatePatientDto } from '../application/dto/update-patient.dto';
import { PaginationQueryDto } from '../../../core/http/dto/pagination-query.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { ADMIN, CLINIC_ADMIN, STAFF } from '../../../core/auth/roles';
import { User as CurrentUser } from '../../../core/auth/decorators/user.decorator';
import { ClinicScope } from '../../../core/auth/decorators/clinic-scope.decorator';
import type { AuthenticatedUser } from '../../../core/auth/roles';

@ApiTags('Patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
  constructor(private readonly service: PatientsService) {}

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Post()
  @ApiOperation({ summary: 'Create a new patient' })
  @ApiBody({ type: CreatePatientDto })
  create(@Body() dto: CreatePatientDto, @ClinicScope() clinicId: string | null) {
    return this.service.create(dto, clinicId);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Get()
  @ApiOperation({ summary: 'List patients (paginated, searchable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query() query: PaginationQueryDto,
    @ClinicScope() clinicId: string | null,
  ) {
    return this.service.findAll(query, clinicId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated patient profile' })
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findMeByUserId(user.userId);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID' })
  findOne(@Param('id') id: string, @ClinicScope() clinicId: string | null) {
    return this.service.findOne(id, clinicId);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a patient' })
  @ApiBody({ type: UpdatePatientDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
    @ClinicScope() clinicId: string | null,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user?.userId, clinicId);
  }

  @Roles(ADMIN)
  @Patch(':id/archive')
  @ApiOperation({ summary: 'Soft-delete (archive) a patient' })
  archive(
    @Param('id') id: string,
    @ClinicScope() clinicId: string | null,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.archive(id, user?.userId, clinicId);
  }

  @Roles(ADMIN)
  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore an archived patient' })
  restore(
    @Param('id') id: string,
    @ClinicScope() clinicId: string | null,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.restore(id, user?.userId, clinicId);
  }

  @Roles(ADMIN)
  @Get(':id/archived')
  @ApiOperation({ summary: 'Get archived patient by ID' })
  findArchived(@Param('id') id: string, @ClinicScope() clinicId: string | null) {
    return this.service.findArchived(id, clinicId);
  }
}
