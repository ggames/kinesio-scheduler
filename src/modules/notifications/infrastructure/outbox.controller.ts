import {
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MailService } from '../../../core/mail/mail.service';
import { AuditService } from '../../../core/audit/audit.service';
import { AuditEventType } from '../../../core/audit/domain/audit-log.entity';
import { OutboxQueryDto } from '../application/dto/outbox-query.dto';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { ADMIN, CLINIC_ADMIN } from '../../../core/auth/roles';
import { ClinicScope } from '../../../core/auth/decorators/clinic-scope.decorator';
import { User as CurrentUser } from '../../../core/auth/decorators/user.decorator';
import type { AuthenticatedUser } from '../../../core/auth/roles';

@ApiTags('Notifications (admin)')
@ApiBearerAuth()
@Roles(ADMIN, CLINIC_ADMIN)
@Controller('notifications/outbox')
export class OutboxController {
  constructor(
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List email outbox entries (paginated)' })
  @ApiQuery({ name: 'status', required: false, type: String })
  findAll(
    @Query() query: OutboxQueryDto,
    @ClinicScope() clinicId: string | null,
  ) {
    return this.mailService.findOutbox({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
      search: query.search,
      clinicId,
    });
  }

  @Post('retry-failed')
  @ApiOperation({ summary: 'Requeue all FAILED outbox emails' })
  async retryFailed(
    @ClinicScope() clinicId: string | null,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const result = await this.mailService.retryFailed(100, clinicId);
    await this.auditService.record({
      eventType: AuditEventType.NOTIFICATION_RETRIED,
      actorUserId: user?.userId ?? null,
      metadata: { scope: 'failed', ...result },
    });
    return result;
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Requeue a single outbox email' })
  async retry(
    @Param('id') id: string,
    @ClinicScope() clinicId: string | null,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const entry = await this.mailService.retryOutbox(id, clinicId);
    await this.auditService.record({
      eventType: AuditEventType.NOTIFICATION_RETRIED,
      actorUserId: user?.userId ?? null,
      metadata: { outboxId: id, template: entry.template },
    });
    return entry;
  }
}
