import { Controller, Post, Get, Body, Param, Req } from '@nestjs/common';
import { TreatmentsService } from '../application/treatments.service';
import { CreateTreatmentDto } from '../application/dto/create-treatment.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { ClinicScope } from '../../../core/auth/decorators/clinic-scope.decorator';
import { ADMIN, CLINIC_ADMIN, STAFF } from '../../../core/auth/roles';

@ApiTags('Treatments')
@ApiBearerAuth()
@Controller('treatments')
export class TreatmentsController {
  constructor(private readonly service: TreatmentsService) {}

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Post()
  @ApiOperation({ summary: 'Create a new treatment plan' })
  @ApiBody({ type: CreateTreatmentDto })
  create(@Body() dto: CreateTreatmentDto, @Req() req: any) {
    return this.service.create(dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'List treatments visible to the authenticated user' })
  findAll(@Req() req: any, @ClinicScope() clinicId: string | null) {
    return this.service.findAll(req.user, clinicId);
  }

  @Get('my')
  @ApiOperation({ summary: 'List treatments for the authenticated patient' })
  findMine(@Req() req: any, @ClinicScope() clinicId: string | null) {
    return this.service.findAll(req.user, clinicId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a treatment plan by ID' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user);
  }

  @Get(':id/sessions')
  @ApiOperation({ summary: 'Get completed sessions for a treatment plan' })
  findSessions(@Param('id') id: string, @Req() req: any) {
    return this.service.findSessions(id, req.user);
  }
}
