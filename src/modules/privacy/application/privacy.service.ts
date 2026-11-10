import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { AuditService } from '../../../core/audit/audit.service';
import { AuditEventType } from '../../../core/audit/domain/audit-log.entity';
import type { AuthenticatedUser } from '../../../core/auth/roles';

@Injectable()
export class PrivacyService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async exportPatient(patientId: string, actor?: AuthenticatedUser): Promise<Record<string, unknown>> {
    const patientRows = await this.dataSource.query(
      `SELECT * FROM "patients" WHERE "id" = $1`,
      [patientId],
    );
    if (patientRows.length === 0) {
      throw new NotFoundException(`Paciente ${patientId} no encontrado`);
    }
    const patient = patientRows[0];
    const personId = patient.personId;

    const [
      person,
      appointments,
      treatments,
      treatmentSessions,
      clinicalNotes,
      medicalHistories,
    ] = await Promise.all([
      this.dataSource.query(`SELECT * FROM "persons" WHERE "id" = $1`, [personId]),
      this.dataSource.query(
        `SELECT * FROM "appointments" WHERE "patientId" = $1 ORDER BY "createdAt" DESC`,
        [patientId],
      ),
      this.dataSource.query(
        `SELECT * FROM "treatments" WHERE "patientId" = $1 ORDER BY "createdAt" DESC`,
        [patientId],
      ),
      this.dataSource.query(
        `SELECT ts.* FROM "treatment_sessions" ts
         INNER JOIN "treatments" t ON t."id" = ts."treatmentId"
         WHERE t."patientId" = $1 ORDER BY ts."createdAt" DESC`,
        [patientId],
      ),
      this.dataSource.query(
        `SELECT * FROM "clinical_notes" WHERE "patientId" = $1 ORDER BY "createdAt" DESC`,
        [patientId],
      ),
      this.dataSource.query(
        `SELECT * FROM "medical_histories" WHERE "patientId" = $1 ORDER BY "createdAt" DESC`,
        [patientId],
      ),
    ]);

    await this.auditService.record({
      eventType: AuditEventType.DATA_EXPORTED,
      actorUserId: actor?.userId ?? null,
      metadata: { patientId, scope: 'patient' },
    });

    return {
      exportedAt: new Date().toISOString(),
      patient,
      person: person[0] ?? null,
      appointments,
      treatments,
      treatmentSessions,
      clinicalNotes,
      medicalHistories,
    };
  }

  async anonymizePatient(
    patientId: string,
    actor: AuthenticatedUser,
  ): Promise<{ anonymized: true; patientId: string }> {
    const patientRows = await this.dataSource.query(
      `SELECT "personId" FROM "patients" WHERE "id" = $1`,
      [patientId],
    );
    if (patientRows.length === 0) {
      throw new NotFoundException(`Paciente ${patientId} no encontrado`);
    }

    const personId = patientRows[0].personId as string;
    const anonymousDocument = `ANON-${randomUUID()}`;

    await this.dataSource.transaction(async (manager) => {
      const personRows = await manager.query(
        `SELECT "userId" FROM "persons" WHERE "id" = $1`,
        [personId],
      );
      const userId = personRows[0]?.userId as string | null | undefined;

      if (userId) {
        await manager.query(
          `UPDATE "users"
           SET "email" = $1,
               "passwordHash" = '',
               "status" = 'INACTIVE',
               "role" = 'PATIENT',
               "roles" = 'PATIENT',
               "tokenVersion" = "tokenVersion" + 1,
               "activationTokenHash" = NULL,
               "activationTokenExpiresAt" = NULL
           WHERE "id" = $2`,
          [`anon-${randomUUID()}@anon.invalid`, userId],
        );
        await manager.query(
          `UPDATE "refresh_tokens" SET "revokedAt" = now() WHERE "userId" = $1 AND "revokedAt" IS NULL`,
          [userId],
        );
      }

      await manager.query(
        `UPDATE "persons"
         SET "firstName" = 'ANONIMIZADO',
             "lastName" = 'ANONIMIZADO',
             "documentId" = $1,
             "birthDate" = NULL,
             "gender" = 'NOT_SPECIFIED',
             "phone" = NULL,
             "email" = NULL,
             "address" = NULL,
             "emergencyContactName" = NULL,
             "emergencyContactPhone" = NULL,
             "archivedAt" = now(),
             "archivedByUserId" = $2
         WHERE "id" = $3`,
        [anonymousDocument, actor.userId, personId],
      );

      await manager.query(
        `UPDATE "patients"
         SET "archivedAt" = now(), "archivedByUserId" = $1
         WHERE "id" = $2`,
        [actor.userId, patientId],
      );
    });

    await this.auditService.record({
      eventType: AuditEventType.DATA_ANONYMIZED,
      actorUserId: actor.userId,
      metadata: { patientId, personId },
    });

    return { anonymized: true, patientId };
  }
}
