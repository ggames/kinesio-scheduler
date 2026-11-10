import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { normalizeEmail } from '../utils/email.util';
import { EmailOutbox, EmailOutboxStatus } from './domain/email-outbox.entity';
import { TokenCipher } from './token-cipher';
import type {
  AppointmentEmailTemplate,
  AppointmentTemplatePayload,
} from './templates/appointment.template';

export interface ActivationEmailInput {
  to: string;
  firstName: string;
  token: string;
  clinicId?: string | null;
}

export interface AppointmentEmailInput extends AppointmentTemplatePayload {
  to: string;
  template: AppointmentEmailTemplate;
  clinicId?: string | null;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenCipher: TokenCipher,
    @InjectRepository(EmailOutbox)
    private readonly outboxRepository: Repository<EmailOutbox>,
  ) {}

  async enqueueActivationEmail(
    manager: EntityManager,
    input: ActivationEmailInput,
  ): Promise<EmailOutbox> {
    const baseUrl = (
      this.configService.get<string>('APP_URL') || 'http://localhost:3000'
    ).replace(/\/+$/, '');
    const activationUrl = `${baseUrl}/activate-account?token=${encodeURIComponent(input.token)}`;
    const encryptedActivationUrl = this.tokenCipher.encrypt(activationUrl);

    const entry = manager.create(EmailOutbox, {
      to: normalizeEmail(input.to),
      template: 'activation',
      clinicId: input.clinicId ?? null,
      payload: {
        firstName: input.firstName,
        encryptedActivationUrl,
      },
      status: EmailOutboxStatus.PENDING,
      attempts: 0,
      nextAttemptAt: new Date(),
    });

    await manager.save(EmailOutbox, entry);
    this.logger.log(`Email de activación encolado para ${entry.to}`);
    return entry;
  }

  async enqueuePasswordResetEmail(
    manager: EntityManager,
    input: ActivationEmailInput,
  ): Promise<EmailOutbox> {
    const baseUrl = (
      this.configService.get<string>('APP_URL') || 'http://localhost:3000'
    ).replace(/\/+$/, '');
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(input.token)}`;
    const encryptedResetUrl = this.tokenCipher.encrypt(resetUrl);

    const entry = manager.create(EmailOutbox, {
      to: normalizeEmail(input.to),
      template: 'reset-password',
      clinicId: input.clinicId ?? null,
      payload: {
        firstName: input.firstName,
        encryptedResetUrl,
      },
      status: EmailOutboxStatus.PENDING,
      attempts: 0,
      nextAttemptAt: new Date(),
    });

    await manager.save(EmailOutbox, entry);
    this.logger.log(`Email de restablecimiento de contraseña encolado para ${entry.to}`);
    return entry;
  }

  async enqueueWelcomeEmail(
    manager: EntityManager,
    input: { to: string; firstName: string; clinicId?: string | null },
  ): Promise<EmailOutbox> {
    const entry = manager.create(EmailOutbox, {
      to: normalizeEmail(input.to),
      template: 'welcome',
      clinicId: input.clinicId ?? null,
      payload: { firstName: input.firstName },
      status: EmailOutboxStatus.PENDING,
      attempts: 0,
      nextAttemptAt: new Date(),
    });

    await manager.save(EmailOutbox, entry);
    this.logger.log(`Email de bienvenida encolado para ${entry.to}`);
    return entry;
  }

  async enqueueAppointmentEmail(
    manager: EntityManager,
    input: AppointmentEmailInput,
  ): Promise<EmailOutbox> {
    const entry = manager.create(EmailOutbox, {
      to: normalizeEmail(input.to),
      template: input.template,
      clinicId: input.clinicId ?? null,
      payload: {
        firstName: input.firstName,
        date: input.date,
        time: input.time,
        professionalName: input.professionalName,
        reason: input.reason ?? '',
      },
      status: EmailOutboxStatus.PENDING,
      attempts: 0,
      nextAttemptAt: new Date(),
    });

    await manager.save(EmailOutbox, entry);
    this.logger.log(
      `Email de turno (${input.template}) encolado para ${entry.to}`,
    );
    return entry;
  }

  async findOutbox(params: {
    page: number;
    limit: number;
    status?: EmailOutboxStatus;
    search?: string;
    clinicId?: string | null;
  }): Promise<{ data: EmailOutbox[]; meta: any }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const qb = this.outboxRepository
      .createQueryBuilder('outbox')
      .orderBy('outbox.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (params.clinicId) {
      qb.andWhere('outbox.clinicId = :clinicId', { clinicId: params.clinicId });
    }
    if (params.status) {
      qb.andWhere('outbox.status = :status', { status: params.status });
    }
    if (params.search) {
      qb.andWhere(
        '(outbox.to ILIKE :search OR outbox.template ILIKE :search)',
        { search: `%${params.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    const pageCount = Math.max(1, Math.ceil(total / limit));
    return {
      data,
      meta: { page, limit, total, pageCount, hasNext: page < pageCount, hasPrevious: page > 1 },
    };
  }

  async retryOutbox(
    id: string,
    clinicId?: string | null,
  ): Promise<EmailOutbox> {
    const entry = await this.outboxRepository.findOne({ where: { id } });
    if (!entry || (clinicId && entry.clinicId !== clinicId)) {
      throw new NotFoundException(`Outbox email ${id} not found`);
    }
    entry.status = EmailOutboxStatus.PENDING;
    entry.attempts = 0;
    entry.nextAttemptAt = new Date();
    entry.lastError = null;
    return this.outboxRepository.save(entry);
  }

  async retryFailed(
    _limit = 100,
    clinicId?: string | null,
  ): Promise<{ retried: number }> {
    const query = this.outboxRepository
      .createQueryBuilder()
      .update(EmailOutbox)
      .set({
        status: EmailOutboxStatus.PENDING,
        attempts: 0,
        nextAttemptAt: () => 'now()',
        lastError: null,
      })
      .where('status = :status', { status: EmailOutboxStatus.FAILED });
    if (clinicId) {
      query.andWhere('outbox.clinicId = :clinicId', { clinicId });
    }
    const result = await query.execute();
    return { retried: result.affected ?? 0 };
  }
}
