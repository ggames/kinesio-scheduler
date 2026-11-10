import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrivacyService } from '../application/privacy.service';
import { AnonymizePatientDto } from '../application/dto/anonymize-patient.dto';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { ADMIN } from '../../../core/auth/roles';
import { User as CurrentUser } from '../../../core/auth/decorators/user.decorator';
import type { AuthenticatedUser } from '../../../core/auth/roles';

@ApiTags('Privacy')
@ApiBearerAuth()
@Roles(ADMIN)
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly service: PrivacyService) {}

  @Get('patients/:patientId/export')
  @ApiOperation({ summary: 'Export all data held for a patient (JSON)' })
  exportPatient(
    @Param('patientId') patientId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.exportPatient(patientId, user);
  }

  @Post('patients/:patientId/anonymize')
  @ApiOperation({ summary: 'Irreversibly anonymize a patient (requires confirm=true)' })
  anonymizePatient(
    @Param('patientId') patientId: string,
    @Body() _dto: AnonymizePatientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.anonymizePatient(patientId, user);
  }
}
