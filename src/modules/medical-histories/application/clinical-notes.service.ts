import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { ClinicalNote } from '../domain/clinical-note.entity';
import {
  CreateClinicalNoteDto,
  UpdateClinicalNoteDto,
} from './dto/clinical-note.dto';
import { AuthorizationService } from '../../../core/auth/authorization.service';
import {
  ADMIN,
  AuthenticatedUser,
  hasAnyRole,
  isStaff,
} from '../../../core/auth/roles';
import { AuditService } from '../../../core/audit/audit.service';
import { AuditEventType } from '../../../core/audit/domain/audit-log.entity';

@Injectable()
export class ClinicalNotesService {
  constructor(
    @InjectRepository(ClinicalNote)
    private readonly repo: Repository<ClinicalNote>,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    dto: CreateClinicalNoteDto,
    user: AuthenticatedUser,
  ): Promise<ClinicalNote> {
    await this.authorizationService.assertCanWriteClinicalRecord(
      user,
      dto.patientId,
    );

    const ownProfessionalId =
      await this.authorizationService.getProfessionalIdForUser(user.userId);
    const professionalId = ownProfessionalId ?? dto.professionalId;
    if (!professionalId) {
      throw new BadRequestException(
        'Se requiere un profesional para crear la nota clínica',
      );
    }
    if (
      ownProfessionalId &&
      dto.professionalId &&
      dto.professionalId !== ownProfessionalId &&
      !hasAnyRole(user, ADMIN)
    ) {
      throw new BadRequestException(
        'No se puede crear una nota a nombre de otro profesional',
      );
    }

    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('El contenido de la nota no puede estar vacío');
    }

    const clinicId =
      (await this.authorizationService.getPatientClinicId(dto.patientId)) ??
      (await this.authorizationService.getDefaultClinicId());

    const entity = this.repo.create({
      patientId: dto.patientId,
      clinicId,
      professionalId,
      appointmentId: dto.appointmentId ?? null,
      treatmentId: dto.treatmentId ?? null,
      content,
    });
    const saved = await this.repo.save(entity);

    await this.auditService.record({
      eventType: AuditEventType.CLINICAL_NOTE_CREATED,
      actorUserId: user.userId,
      metadata: {
        clinicalNoteId: saved.id,
        patientId: saved.patientId,
        professionalId: saved.professionalId,
      },
    });

    return saved;
  }

  async findAll(
    user: AuthenticatedUser,
    patientId?: string,
    clinicId?: string | null,
  ): Promise<ClinicalNote[]> {
    if (patientId) {
      await this.authorizationService.assertCanReadClinicalRecord(
        user,
        patientId,
      );
    }

    const where: Record<string, unknown> = {};
    if (patientId) where.patientId = patientId;
    if (clinicId) where.clinicId = clinicId;

    if (!isStaff(user)) {
      const ownPatientId =
        await this.authorizationService.getPatientIdForUser(user.userId);
      if (!ownPatientId) return [];
      where.patientId = ownPatientId;
      where.signedAt = Not(IsNull());
    } else if (!hasAnyRole(user, ADMIN)) {
      const readable = await this.authorizationService.getReadablePatientIds(user);
      if (readable !== null) {
        if (readable.size === 0) return [];
        where.patientId = In(Array.from(readable));
      }
    }

    const notes = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    return notes;
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<ClinicalNote> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) {
      throw new NotFoundException(`Nota clínica ${id} no encontrada`);
    }

    await this.authorizationService.assertCanReadClinicalRecord(
      user,
      found.patientId,
    );

    if (!isStaff(user) && !found.signedAt) {
      throw new NotFoundException(`Nota clínica ${id} no encontrada`);
    }

    await this.auditService.record({
      eventType: AuditEventType.CLINICAL_NOTE_VIEWED,
      actorUserId: user.userId,
      metadata: { clinicalNoteId: id, patientId: found.patientId },
    });

    return found;
  }

  async update(
    id: string,
    dto: UpdateClinicalNoteDto,
    user: AuthenticatedUser,
  ): Promise<ClinicalNote> {
    const found = await this.findOne(id, user);
    if (found.signedAt) {
      throw new ConflictException(
        'La nota clínica ya está firmada y no puede modificarse',
      );
    }
    await this.authorizationService.assertCanWriteClinicalRecord(
      user,
      found.patientId,
    );

    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('El contenido de la nota no puede estar vacío');
    }

    found.content = content;
    const saved = await this.repo.save(found);

    await this.auditService.record({
      eventType: AuditEventType.CLINICAL_NOTE_UPDATED,
      actorUserId: user.userId,
      metadata: { clinicalNoteId: id, patientId: found.patientId },
    });

    return saved;
  }

  async sign(id: string, user: AuthenticatedUser): Promise<ClinicalNote> {
    const found = await this.findOne(id, user);
    if (found.signedAt) return found;

    await this.authorizationService.assertCanWriteClinicalRecord(
      user,
      found.patientId,
    );

    const professionalId =
      await this.authorizationService.getProfessionalIdForUser(user.userId);

    found.signedAt = new Date();
    found.signedByProfessionalId = professionalId ?? null;
    const saved = await this.repo.save(found);

    await this.auditService.record({
      eventType: AuditEventType.CLINICAL_NOTE_SIGNED,
      actorUserId: user.userId,
      metadata: {
        clinicalNoteId: id,
        patientId: found.patientId,
        signedByProfessionalId: found.signedByProfessionalId,
      },
    });

    return saved;
  }

  private async filterReadable(
    notes: ClinicalNote[],
    user: AuthenticatedUser,
  ): Promise<ClinicalNote[]> {
    const readable = await this.authorizationService.getReadablePatientIds(user);
    if (readable === null) return notes;
    return notes.filter((note) => readable.has(note.patientId));
  }
}
