import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ClinicalNotesService } from '../application/clinical-notes.service';
import {
  CreateClinicalNoteDto,
  FindClinicalNotesQueryDto,
  UpdateClinicalNoteDto,
} from '../application/dto/clinical-note.dto';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { ClinicScope } from '../../../core/auth/decorators/clinic-scope.decorator';
import { ADMIN, CLINIC_ADMIN, STAFF } from '../../../core/auth/roles';

@ApiTags('Clinical Notes')
@ApiBearerAuth()
@Controller('clinical-notes')
export class ClinicalNotesController {
  constructor(private readonly service: ClinicalNotesService) {}

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Post()
  @ApiOperation({ summary: 'Create a clinical note (draft until signed)' })
  @ApiBody({ type: CreateClinicalNoteDto })
  create(@Body() dto: CreateClinicalNoteDto, @Req() req: any) {
    return this.service.create(dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'List clinical notes visible to the authenticated user' })
  findAll(
    @Query() query: FindClinicalNotesQueryDto,
    @Req() req: any,
    @ClinicScope() clinicId: string | null,
  ) {
    return this.service.findAll(req.user, query.patientId, clinicId);
  }

  @Get('my')
  @ApiOperation({ summary: 'List signed clinical notes for the authenticated patient' })
  findMine(@Req() req: any, @ClinicScope() clinicId: string | null) {
    return this.service.findAll(req.user, undefined, clinicId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a clinical note by ID' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Patch(':id')
  @ApiOperation({ summary: 'Update an unsigned clinical note' })
  @ApiBody({ type: UpdateClinicalNoteDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClinicalNoteDto,
    @Req() req: any,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Post(':id/sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign a clinical note (becomes immutable)' })
  sign(@Param('id') id: string, @Req() req: any) {
    return this.service.sign(id, req.user);
  }
}
