import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportFilterDto } from './dto/report-filter.dto';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { ClinicScope } from '../../core/auth/decorators/clinic-scope.decorator';
import { ADMIN, CLINIC_ADMIN, STAFF } from '../../core/auth/roles';

@ApiTags('Reports')
@ApiBearerAuth()
@Roles(ADMIN, CLINIC_ADMIN, STAFF)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('absenteeism-abandonment')
  @ApiOperation({ summary: 'Listado de ausentismo y abandono de tratamiento' })
  getAbsenteeismAndAbandonment(
    @Query() filter: ReportFilterDto,
    @ClinicScope() clinicId: string | null,
  ) {
    return this.reportsService.obtenerAusentismoYAbandono(filter, clinicId);
  }

  @Get('agenda-occupancy')
  @ApiOperation({ summary: 'Métricas de ocupación y ociosidad de la agenda' })
  getAgendaOccupancy(
    @Query() filter: ReportFilterDto,
    @ClinicScope() clinicId: string | null,
  ) {
    return this.reportsService.obtenerOcupacionAgenda(filter, clinicId);
  }

  @Get('treatment-status-summary')
  @ApiOperation({ summary: 'Resumen de tratamientos por estado' })
  getTreatmentStatusSummary(
    @Query() filter: ReportFilterDto,
    @ClinicScope() clinicId: string | null,
  ) {
    return this.reportsService.obtenerResumenTratamientos(filter, clinicId);
  }
}
