import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { ADMIN, CLINIC_ADMIN } from '../auth/roles';
import { User as CurrentUser } from '../auth/decorators/user.decorator';
import { ClinicScope } from '../auth/decorators/clinic-scope.decorator';
import type { AuthenticatedUser } from '../auth/roles';

@ApiTags('Audit')
@ApiBearerAuth()
@Roles(ADMIN, CLINIC_ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit events (paginated, filterable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'eventType', required: false, type: String })
  @ApiQuery({ name: 'actorUserId', required: false, type: String })
  @ApiQuery({ name: 'targetUserId', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  findAll(
    @Query() query: AuditQueryDto,
    @ClinicScope() clinicId: string | null,
  ) {
    return this.service.findAll(query, clinicId);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export audit events as CSV (max 10k rows)' })
  async export(
    @Query() query: AuditQueryDto,
    @ClinicScope() clinicId: string | null,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.service.exportCsv(query, user?.userId, clinicId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-logs-${timestamp}.csv"`,
    );
    res.send(csv);
  }
}
