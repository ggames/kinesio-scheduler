import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContextService } from '../request-context/request-context.service';
import { AuditLog } from './domain/audit-log.entity';
import { AuditEventType } from './domain/audit-log.entity';
import { AuditQueryDto } from './dto/audit-query.dto';
import { User } from '../../modules/users/domain/user.entity';

export interface AuditEvent {
  eventType: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  clinicId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly requestContext: RequestContextService,
  ) {}

  async record(event: AuditEvent): Promise<void> {
    const context = this.requestContext.get();

    try {
      const clinicId =
        event.clinicId ?? (await this.resolveClinicId(event));
      await this.auditRepository.save(
        this.auditRepository.create({
          eventType: event.eventType,
          actorUserId: event.actorUserId ?? null,
          targetUserId: event.targetUserId ?? null,
          clinicId,
          ip: context?.ip ?? null,
          userAgent: context?.userAgent ?? null,
          requestId: context?.requestId ?? null,
          metadata: event.metadata ?? {},
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo registrar evento de auditoría: ${message}`);
    }
  }

  private async resolveClinicId(event: AuditEvent): Promise<string | null> {
    const userId = event.actorUserId ?? event.targetUserId;
    if (!userId) return null;
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: { id: true, clinicId: true },
      });
      return user?.clinicId ?? null;
    } catch {
      return null;
    }
  }

  async findAll(
    query: AuditQueryDto,
    clinicId?: string | null,
  ): Promise<{
    data: AuditLog[];
    meta: {
      page: number;
      limit: number;
      total: number;
      pageCount: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.auditRepository
      .createQueryBuilder('audit')
      .orderBy('audit.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    this.applyFilters(qb, query, clinicId);

    const [data, total] = await qb.getManyAndCount();
    const pageCount = Math.max(1, Math.ceil(total / limit));
    return {
      data,
      meta: {
        page,
        limit,
        total,
        pageCount,
        hasNext: page < pageCount,
        hasPrevious: page > 1,
      },
    };
  }

  async exportCsv(
    query: AuditQueryDto,
    actorUserId?: string,
    clinicId?: string | null,
  ): Promise<string> {
    const qb = this.auditRepository
      .createQueryBuilder('audit')
      .orderBy('audit.createdAt', 'DESC')
      .take(10000);

    this.applyFilters(qb, query, clinicId);

    const rows = await qb.getMany();
    const header = [
      'id',
      'eventType',
      'actorUserId',
      'targetUserId',
      'ip',
      'requestId',
      'metadata',
      'createdAt',
    ];

    const csv = [
      header.join(','),
      ...rows.map((row) =>
        [
          row.id,
          row.eventType,
          row.actorUserId ?? '',
          row.targetUserId ?? '',
          row.ip ?? '',
          row.requestId ?? '',
          JSON.stringify(row.metadata ?? {}),
          row.createdAt?.toISOString() ?? '',
        ]
          .map(csvEscape)
          .join(','),
      ),
    ].join('\n');

    await this.record({
      eventType: AuditEventType.AUDIT_EXPORTED,
      actorUserId: actorUserId ?? null,
      metadata: { filters: { ...query }, rowCount: rows.length },
    });

    return csv;
  }

  private applyFilters(
    qb: ReturnType<Repository<AuditLog>['createQueryBuilder']>,
    query: AuditQueryDto,
    clinicId?: string | null,
  ): void {
    if (clinicId) {
      qb.andWhere('audit.clinicId = :clinicId', { clinicId });
    }
    if (query.eventType) {
      qb.andWhere('audit.eventType = :eventType', {
        eventType: query.eventType,
      });
    }
    if (query.actorUserId) {
      qb.andWhere('audit.actorUserId = :actorUserId', {
        actorUserId: query.actorUserId,
      });
    }
    if (query.targetUserId) {
      qb.andWhere('audit.targetUserId = :targetUserId', {
        targetUserId: query.targetUserId,
      });
    }
    if (query.from) {
      qb.andWhere('audit.createdAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('audit.createdAt <= :to', { to: query.to });
    }
    if (query.search) {
      qb.andWhere('audit.eventType ILIKE :search', {
        search: `%${query.search}%`,
      });
    }
  }
}

function csvEscape(value: string): string {
  let safe = value ?? '';
  if (/^[=+\-@]/.test(safe)) safe = `'${safe}`;
  return `"${safe.replace(/"/g, '""')}"`;
}
