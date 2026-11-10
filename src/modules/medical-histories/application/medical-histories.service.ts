import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { MedicalHistory } from '../domain/medical-history.entity';
import {
  CreateMedicalHistoryDto,
  UpdateMedicalHistoryDto,
} from './dto/create-medical-history.dto';
import { AuthorizationService } from '../../../core/auth/authorization.service';
import { AuthenticatedUser } from '../../../core/auth/roles';
import { AuditService } from '../../../core/audit/audit.service';
import { AuditEventType } from '../../../core/audit/domain/audit-log.entity';

@Injectable()
export class MedicalHistoriesService {
  constructor(
    @InjectRepository(MedicalHistory)
    private readonly repo: Repository<MedicalHistory>,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    dto: CreateMedicalHistoryDto,
    user: AuthenticatedUser,
  ): Promise<MedicalHistory> {
    await this.authorizationService.assertCanWriteClinicalRecord(
      user,
      dto.patientId,
    );

    const existing = await this.repo.findOne({
      where: { patient: { id: dto.patientId }, archivedAt: IsNull() },
    });
    if (existing) {
      throw new ConflictException(
        `El paciente ${dto.patientId} ya tiene una historia clínica activa`,
      );
    }

    const entity = this.repo.create({
      patient: { id: dto.patientId } as any,
      medicalRecordNumber: dto.medicalRecordNumber,
      diagnosis: dto.diagnosis,
      referringDoctor: dto.referringDoctor,
      medicalReferralDocument: dto.medicalReferralDocument,
      medicalHistory: dto.medicalHistory,
    });
    const saved = await this.repo.save(entity);

    await this.auditService.record({
      eventType: AuditEventType.MEDICAL_HISTORY_CREATED,
      actorUserId: user.userId,
      metadata: { medicalHistoryId: saved.id, patientId: dto.patientId },
    });

    return saved;
  }

  async findAll(user: AuthenticatedUser): Promise<MedicalHistory[]> {
    const histories = await this.repo.find({
      where: { archivedAt: IsNull() },
      relations: { patient: { person: true } },
      order: { createdAt: 'DESC' },
    });

    return this.filterReadable(histories, user);
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<MedicalHistory> {
    const found = await this.repo.findOne({
      where: { id, archivedAt: IsNull() },
      relations: { patient: { person: true } },
    });
    if (!found) {
      throw new NotFoundException(`Medical history ${id} not found`);
    }
    await this.authorizationService.assertCanReadClinicalRecord(
      user,
      found.patient?.id,
    );

    await this.auditService.record({
      eventType: AuditEventType.MEDICAL_HISTORY_VIEWED,
      actorUserId: user.userId,
      metadata: { medicalHistoryId: id, patientId: found.patient?.id },
    });

    return found;
  }

  async findByPatientId(
    patientId: string,
    user: AuthenticatedUser,
  ): Promise<MedicalHistory> {
    await this.authorizationService.assertCanReadClinicalRecord(user, patientId);

    const found = await this.repo.findOne({
      where: { patient: { id: patientId }, archivedAt: IsNull() },
      relations: { patient: { person: true } },
    });
    if (!found) {
      throw new NotFoundException(
        `Medical history for patient ${patientId} not found`,
      );
    }

    await this.auditService.record({
      eventType: AuditEventType.MEDICAL_HISTORY_VIEWED,
      actorUserId: user.userId,
      metadata: { medicalHistoryId: found.id, patientId },
    });

    return found;
  }

  async update(
    id: string,
    dto: UpdateMedicalHistoryDto,
    user: AuthenticatedUser,
  ): Promise<MedicalHistory> {
    const found = await this.repo.findOne({
      where: { id, archivedAt: IsNull() },
      relations: { patient: { person: true } },
    });
    if (!found) {
      throw new NotFoundException(`Medical history ${id} not found`);
    }
    await this.authorizationService.assertCanWriteClinicalRecord(
      user,
      found.patient?.id,
    );

    if (dto.medicalRecordNumber !== undefined) {
      found.medicalRecordNumber = dto.medicalRecordNumber;
    }
    if (dto.diagnosis !== undefined) found.diagnosis = dto.diagnosis;
    if (dto.referringDoctor !== undefined) {
      found.referringDoctor = dto.referringDoctor;
    }
    if (dto.medicalReferralDocument !== undefined) {
      found.medicalReferralDocument = dto.medicalReferralDocument;
    }
    if (dto.medicalHistory !== undefined) {
      found.medicalHistory = dto.medicalHistory;
    }
    const saved = await this.repo.save(found);

    await this.auditService.record({
      eventType: AuditEventType.MEDICAL_HISTORY_UPDATED,
      actorUserId: user.userId,
      metadata: { medicalHistoryId: id, patientId: found.patient?.id },
    });

    return saved;
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const found = await this.repo.findOne({
      where: { id, archivedAt: IsNull() },
      relations: { patient: { person: true } },
    });
    if (!found) {
      throw new NotFoundException(`Medical history ${id} not found`);
    }
    await this.authorizationService.assertCanWriteClinicalRecord(
      user,
      found.patient?.id,
    );

    found.archivedAt = new Date();
    found.archivedByUserId = user.userId;
    await this.repo.save(found);

    await this.auditService.record({
      eventType: AuditEventType.MEDICAL_HISTORY_ARCHIVED,
      actorUserId: user.userId,
      metadata: { medicalHistoryId: id, patientId: found.patient?.id },
    });
  }

  private async filterReadable(
    histories: MedicalHistory[],
    user: AuthenticatedUser,
  ): Promise<MedicalHistory[]> {
    const readable = await this.authorizationService.getReadablePatientIds(user);
    if (readable === null) return histories;
    return histories.filter(
      (history) => history.patient?.id && readable.has(history.patient.id),
    );
  }
}
