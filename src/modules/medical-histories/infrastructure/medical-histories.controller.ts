import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MedicalHistoriesService } from '../application/medical-histories.service';
import {
  CreateMedicalHistoryDto,
  UpdateMedicalHistoryDto,
} from '../application/dto/create-medical-history.dto';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { ADMIN, CLINIC_ADMIN, STAFF } from '../../../core/auth/roles';

@ApiTags('Medical Histories')
@ApiBearerAuth()
@Controller('medical-histories')
export class MedicalHistoriesController {
  constructor(private readonly service: MedicalHistoriesService) {}

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Post()
  @ApiOperation({ summary: 'Create a new medical history record' })
  @ApiBody({ type: CreateMedicalHistoryDto })
  create(@Body() dto: CreateMedicalHistoryDto, @Req() req: any) {
    return this.service.create(dto, req.user);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Get()
  @ApiOperation({ summary: 'Get all medical history records' })
  findAll(@Req() req: any) {
    return this.service.findAll(req.user);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get medical history records for the authenticated patient' })
  findMine(@Req() req: any) {
    return this.service.findAll(req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a medical history record by ID' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get medical history record by patient ID' })
  findByPatientId(@Param('patientId') patientId: string, @Req() req: any) {
    return this.service.findByPatientId(patientId, req.user);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Put(':id')
  @ApiOperation({ summary: 'Update a medical history record' })
  @ApiBody({ type: UpdateMedicalHistoryDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMedicalHistoryDto,
    @Req() req: any,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Delete(':id')
  @ApiOperation({ summary: 'Archive a medical history record (soft delete)' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user);
  }
}
