import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../../core/auth/roles';
import { hasAnyRole, isStaff, ADMIN } from '../../../core/auth/roles';
import { AuthorizationService } from '../../../core/auth/authorization.service';
import { AuditService } from '../../../core/audit/audit.service';
import { AuditEventType } from '../../../core/audit/domain/audit-log.entity';
import { Appointment } from '../../appointments/domain/appointment.entity';
import { Patient } from '../../patients/domain/patient.entity';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { Treatment, TreatmentStatus } from '../domain/treatment.entity';
import {
  TreatmentSession,
  TreatmentSessionStatus,
} from '../domain/treatment-session.entity';

@Injectable()
export class TreatmentsService {
  constructor(
    @InjectRepository(Treatment)
    private readonly repo: Repository<Treatment>,
    @InjectRepository(TreatmentSession)
    private readonly sessionRepo: Repository<TreatmentSession>,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateTreatmentDto, user: AuthenticatedUser): Promise<Treatment> {
    await this.authorizationService.assertCanWriteClinicalRecord(user, dto.patientId);

    const ownProfessionalId =
      await this.authorizationService.getProfessionalIdForUser(user.userId);
    if (
      ownProfessionalId &&
      dto.professionalId !== ownProfessionalId &&
      !hasAnyRole(user, ADMIN)
    ) {
      throw new BadRequestException(
        'No se puede crear un tratamiento a nombre de otro profesional',
      );
    }

    const entity = this.repo.create({
      patient: { id: dto.patientId } as any,
      prescribingProfessional: { id: dto.professionalId } as any,
      description: dto.description,
      totalSessions: dto.totalSessions,
      status: TreatmentStatus.ACTIVE,
      startDate: dto.startDate ?? new Date().toISOString().slice(0, 10),
    });

    const patient = await this.repo.manager.findOne(Patient, {
      where: { id: dto.patientId },
    });
    const clinicId =
      dto.clinicId ??
      patient?.clinicId ??
      (await this.authorizationService.getDefaultClinicId());
    entity.clinicId = clinicId;
    entity.clinic = { id: clinicId } as any;
    const saved = await this.repo.save(entity);

    await this.auditService.record({
      eventType: AuditEventType.TREATMENT_CREATED,
      actorUserId: user.userId,
      metadata: {
        treatmentId: saved.id,
        patientId: dto.patientId,
        totalSessions: dto.totalSessions,
      },
    });

    return saved;
  }

  async findAll(
    user: AuthenticatedUser,
    clinicId?: string | null,
  ): Promise<Treatment[]> {
    if (hasAnyRole(user, ADMIN)) {
      return this.repo.find({
        where: clinicId ? { clinicId } : {},
        relations: { patient: { person: true }, prescribingProfessional: { person: true } },
        order: { createdAt: 'DESC' },
      });
    }

    const professionalId = await this.authorizationService.getProfessionalIdForUser(
      user.userId,
    );
    if (professionalId) {
      return this.repo.find({
        where: {
          prescribingProfessional: { id: professionalId },
          ...(clinicId ? { clinicId } : {}),
        },
        relations: { patient: { person: true }, prescribingProfessional: { person: true } },
        order: { createdAt: 'DESC' },
      });
    }

    if (isStaff(user)) {
      return this.repo.find({
        where: clinicId ? { clinicId } : {},
        relations: { patient: { person: true }, prescribingProfessional: { person: true } },
        order: { createdAt: 'DESC' },
      });
    }

    const patientId = await this.authorizationService.getPatientIdForUser(user.userId);
    if (!patientId) return [];

    return this.repo.find({
      where: {
        patient: { id: patientId },
        ...(clinicId ? { clinicId } : {}),
      },
      relations: { patient: { person: true }, prescribingProfessional: { person: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<Treatment> {
    const found = await this.repo.findOne({
      where: { id },
      relations: {
        patient: { person: true },
        prescribingProfessional: { person: true },
      },
    });
    if (!found) {
      throw new NotFoundException(`Tratamiento ${id} no encontrado`);
    }

    await this.authorizationService.assertCanAccessPatient(
      user,
      found.patient?.id,
    );
    return found;
  }

  async findSessions(id: string, user: AuthenticatedUser): Promise<TreatmentSession[]> {
    await this.findOne(id, user);
    return this.sessionRepo.find({
      where: { treatmentId: id },
      order: { sessionNumber: 'ASC' },
    });
  }

  /**
   * Registra la sesión completada dentro de la transacción del turno.
   * No audita aquí: el llamador audita después del commit para evitar eventos falsos.
   */
  async recordCompletedSession(
    manager: EntityManager,
    appointment: Appointment,
    notes?: string,
  ): Promise<{
    session: TreatmentSession | null;
    treatmentCompleted: boolean;
  }> {
    const treatmentId = (appointment.treatment as { id?: string } | undefined)?.id;
    if (!treatmentId) return { session: null, treatmentCompleted: false };

    const existing = await manager.findOne(TreatmentSession, {
      where: { appointmentId: appointment.id },
    });
    if (existing) return { session: existing, treatmentCompleted: false };

    const treatment = await manager.findOne(Treatment, {
      where: { id: treatmentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!treatment) {
      throw new NotFoundException(`Tratamiento ${treatmentId} no encontrado`);
    }
    if (treatment.status !== TreatmentStatus.ACTIVE) {
      throw new ConflictException('El tratamiento no está activo');
    }

    const completedSessions = await manager.count(TreatmentSession, {
      where: { treatmentId, status: TreatmentSessionStatus.COMPLETED },
    });
    if (completedSessions >= treatment.totalSessions) {
      throw new ConflictException('El tratamiento ya alcanzó el máximo de sesiones');
    }

    const session = manager.create(TreatmentSession, {
      treatmentId,
      appointmentId: appointment.id,
      sessionNumber: completedSessions + 1,
      status: TreatmentSessionStatus.COMPLETED,
      notes: notes ?? null,
      completedAt: new Date(),
    });
    const saved = await manager.save(TreatmentSession, session);

    let treatmentCompleted = false;
    if (saved.sessionNumber >= treatment.totalSessions) {
      treatment.status = TreatmentStatus.COMPLETED;
      treatment.endDate = new Date().toISOString().slice(0, 10);
      await manager.save(Treatment, treatment);
      treatmentCompleted = true;
    }

    return { session: saved, treatmentCompleted };
  }
}
