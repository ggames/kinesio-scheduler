import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Person } from '../../modules/persons/domain/person.entity';
import { Patient } from '../../modules/patients/domain/patient.entity';
import { Professional } from '../../modules/professionals/domain/professional.entity';
import { Appointment } from '../../modules/appointments/domain/appointment.entity';
import { Treatment } from '../../modules/treatments/domain/treatment.entity';
import { ADMIN, AuthenticatedUser, hasAnyRole, isStaff } from './roles';
import { assertClinicAccess, resolveClinicId } from './clinic-scope';

interface AppointmentOwnership {
  id?: string;
  clinicId?: string | null;
  patient?: { id?: string; person?: { userId?: string } } | null;
  professional?: { id?: string; person?: { userId?: string } } | null;
}

/**
 * Read-only ownership resolution for resource-level authorization (IDOR).
 * Never creates profiles as a side effect.
 */
@Injectable()
export class AuthorizationService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Professional)
    private readonly professionalRepo: Repository<Professional>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getPatientClinicId(patientId: string): Promise<string | null> {
    if (!patientId) return null;
    const patient = await this.patientRepo.findOne({
      where: { id: patientId },
      select: { id: true, clinicId: true },
    });
    return patient?.clinicId ?? null;
  }

  /**
   * Returns the first clinic or creates a default one when the database has no
   * clinics yet. Used to guarantee clinical records always carry a clinicId.
   */
  async getDefaultClinicId(): Promise<string> {
    const rows: Array<{ id: string }> = await this.dataSource.query(
      'SELECT id FROM clinics ORDER BY name ASC LIMIT 1',
    );
    if (rows[0]?.id) return rows[0].id;

    const inserted: Array<{ id: string }> = await this.dataSource.query(
      `INSERT INTO clinics (name) VALUES ('Clínica Principal') RETURNING id`,
    );
    return inserted[0].id;
  }

  private isOutsideClinic(
    user: AuthenticatedUser,
    clinicId?: string | null,
  ): boolean {
    const scope = resolveClinicId(user);
    return !!scope && clinicId !== scope;
  }

  async getPersonByUserId(userId: string): Promise<Person | null> {
    if (!userId) return null;
    return this.personRepo.findOne({ where: { userId } });
  }

  async assertClinicAccess(
    user: AuthenticatedUser,
    clinicId?: string | null,
  ): Promise<void> {
    if (!clinicId) return;
    assertClinicAccess(user, clinicId);
  }

  async getPatientIdForUser(userId: string): Promise<string | null> {
    const person = await this.getPersonByUserId(userId);
    if (!person) return null;
    const patient = await this.patientRepo.findOne({ where: { personId: person.id } });
    return patient?.id ?? null;
  }

  async getProfessionalIdForUser(userId: string): Promise<string | null> {
    const person = await this.getPersonByUserId(userId);
    if (!person) return null;
    const professional = await this.professionalRepo.findOne({ where: { personId: person.id } });
    return professional?.id ?? null;
  }

  /**
   * Returns the set of patient IDs whose clinical record the user may read,
   * or null when the user can read every patient (ADMIN).
   * Used to avoid N+1 authorization checks when listing clinical records.
   */
  async getReadablePatientIds(
    user: AuthenticatedUser,
  ): Promise<Set<string> | null> {
    if (hasAnyRole(user, ADMIN)) return null;

    const professionalId = await this.getProfessionalIdForUser(user.userId);
    if (professionalId) {
      const rows: { patientId: string }[] = await this.dataSource.query(
        `SELECT DISTINCT "patientId" FROM "appointments" WHERE "professionalId" = $1
         UNION
         SELECT DISTINCT "patientId" FROM "treatments" WHERE "prescribingProfessionalId" = $1`,
        [professionalId],
      );
      return new Set(rows.map((row) => row.patientId).filter(Boolean));
    }

    const patientId = await this.getPatientIdForUser(user.userId);
    return new Set(patientId ? [patientId] : []);
  }

  async isPatientOwner(userId: string, patientId: string): Promise<boolean> {
    const ownPatientId = await this.getPatientIdForUser(userId);
    return !!ownPatientId && ownPatientId === patientId;
  }

  async isTreatingProfessional(
    professionalId: string,
    patientId: string,
  ): Promise<boolean> {
    if (!professionalId || !patientId) return false;

    const appointmentCount = await this.dataSource
      .getRepository(Appointment)
      .createQueryBuilder('appointment')
      .where('appointment.professionalId = :professionalId', { professionalId })
      .andWhere('appointment.patientId = :patientId', { patientId })
      .getCount();

    if (appointmentCount > 0) return true;

    const treatmentCount = await this.dataSource
      .getRepository(Treatment)
      .createQueryBuilder('treatment')
      .where('treatment.prescribingProfessionalId = :professionalId', {
        professionalId,
      })
      .andWhere('treatment.patientId = :patientId', { patientId })
      .getCount();

    return treatmentCount > 0;
  }

  async canAccessPatient(
    user: AuthenticatedUser,
    patientId: string,
  ): Promise<boolean> {
    if (hasAnyRole(user, ADMIN)) return true;

    if (this.isOutsideClinic(user, await this.getPatientClinicId(patientId))) {
      return false;
    }

    const professionalId = await this.getProfessionalIdForUser(user.userId);
    if (professionalId) {
      return this.isTreatingProfessional(professionalId, patientId);
    }

    if (isStaff(user)) return true;

    return this.isPatientOwner(user.userId, patientId);
  }

  async assertCanAccessPatient(
    user: AuthenticatedUser,
    patientId: string,
  ): Promise<void> {
    if (!(await this.canAccessPatient(user, patientId))) {
      throw new NotFoundException(`Paciente ${patientId} no encontrado`);
    }
  }

  async canReadClinicalRecord(
    user: AuthenticatedUser,
    patientId: string,
  ): Promise<boolean> {
    if (hasAnyRole(user, ADMIN)) return true;

    if (this.isOutsideClinic(user, await this.getPatientClinicId(patientId))) {
      return false;
    }

    const professionalId = await this.getProfessionalIdForUser(user.userId);
    if (professionalId) {
      return this.isTreatingProfessional(professionalId, patientId);
    }

    return this.isPatientOwner(user.userId, patientId);
  }

  async assertCanReadClinicalRecord(
    user: AuthenticatedUser,
    patientId: string,
  ): Promise<void> {
    if (!(await this.canReadClinicalRecord(user, patientId))) {
      throw new NotFoundException(`Paciente ${patientId} no encontrado`);
    }
  }

  async assertCanWriteClinicalRecord(
    user: AuthenticatedUser,
    patientId: string,
  ): Promise<void> {
    if (hasAnyRole(user, ADMIN)) return;

    const professionalId = await this.getProfessionalIdForUser(user.userId);
    if (
      professionalId &&
      (await this.isTreatingProfessional(professionalId, patientId))
    ) {
      return;
    }

    throw new NotFoundException(`Paciente ${patientId} no encontrado`);
  }

  async assertCanViewAppointment(
    user: AuthenticatedUser,
    appointment: AppointmentOwnership,
  ): Promise<void> {
    if (hasAnyRole(user, ADMIN)) return;

    assertClinicAccess(user, appointment.clinicId);

    const professionalId = await this.getProfessionalIdForUser(user.userId);
    if (professionalId) {
      if (appointment.professional?.id === professionalId) return;
      throw new NotFoundException(`Cita ${appointment.id ?? ''} no encontrada`);
    }

    if (isStaff(user)) return;

    if (appointment.patient?.person?.userId === user.userId) return;

    throw new NotFoundException(`Cita ${appointment.id ?? ''} no encontrada`);
  }

  async assertCanManageAppointment(
    user: AuthenticatedUser,
    appointment: AppointmentOwnership,
  ): Promise<void> {
    await this.assertCanViewAppointment(user, appointment);
  }

  async assertCanCompleteAppointment(
    user: AuthenticatedUser,
    appointment: AppointmentOwnership,
  ): Promise<void> {
    if (hasAnyRole(user, ADMIN)) return;

    const professionalId = await this.getProfessionalIdForUser(user.userId);
    if (professionalId && appointment.professional?.id === professionalId) {
      return;
    }

    throw new NotFoundException(`Cita ${appointment.id ?? ''} no encontrada`);
  }

  async assertStaffCanManageAppointment(
    user: AuthenticatedUser,
    appointment: AppointmentOwnership,
  ): Promise<void> {
    if (hasAnyRole(user, ADMIN)) return;

    const professionalId = await this.getProfessionalIdForUser(user.userId);
    if (professionalId) {
      if (appointment.professional?.id === professionalId) return;
      throw new NotFoundException(`Cita ${appointment.id ?? ''} no encontrada`);
    }

    if (isStaff(user)) return;

    throw new NotFoundException(`Cita ${appointment.id ?? ''} no encontrada`);
  }
}
