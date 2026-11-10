import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase3ClinicalCore1793980272081 implements MigrationInterface {
    name = 'Phase3ClinicalCore1793980272081'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "clinical_notes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "patientId" uuid NOT NULL, "professionalId" uuid NOT NULL, "appointmentId" uuid, "treatmentId" uuid, "content" text NOT NULL, "signedAt" TIMESTAMP WITH TIME ZONE, "signedByProfessionalId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_clinical_notes_content" CHECK (length(trim("content")) > 0), CONSTRAINT "PK_590ad4cecf429ecc12e8202cbb4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_clinical_notes_signedAt" ON "clinical_notes"  ("signedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_clinical_notes_professionalId" ON "clinical_notes"  ("professionalId") `);
        await queryRunner.query(`CREATE INDEX "IDX_clinical_notes_patientId" ON "clinical_notes"  ("patientId") `);
        await queryRunner.query(`CREATE TABLE "treatment_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "treatmentId" uuid NOT NULL, "appointmentId" uuid NOT NULL, "sessionNumber" integer NOT NULL, "status" character varying NOT NULL DEFAULT 'COMPLETED', "notes" text, "completedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f301891fd97dab91f2c0fe18614" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_treatment_sessions_appointmentId" ON "treatment_sessions"  ("appointmentId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_treatment_sessions_treatmentId_sessionNumber" ON "treatment_sessions"  ("treatmentId", "sessionNumber") `);
        await queryRunner.query(`ALTER TABLE "treatments" ADD "status" character varying NOT NULL DEFAULT 'ACTIVE'`);
        await queryRunner.query(`ALTER TABLE "treatments" ADD "startDate" date`);
        await queryRunner.query(`ALTER TABLE "treatments" ADD "endDate" date`);
        await queryRunner.query(`ALTER TABLE "treatments" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "treatments" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "attendedByProfessionalId" uuid`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "confirmedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "completedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "cancelledAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "cancelledByUserId" uuid`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "cancellationReason" text`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "noShowAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "rescheduledAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "rescheduledByUserId" uuid`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "notes" text`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "reminderSentAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "medical_histories" ADD "archivedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "medical_histories" ADD "archivedByUserId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_time_slots_status" ON "time_slots"  ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_treatments_professionalId_status" ON "treatments"  ("prescribingProfessionalId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_treatments_patientId_status" ON "treatments"  ("patientId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_appointments_professionalId_status" ON "appointments"  ("professionalId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_appointments_patientId_status" ON "appointments"  ("patientId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_appointments_timeSlotId_status" ON "appointments"  ("timeSlotId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_appointments_status" ON "appointments"  ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_medical_histories_archivedAt" ON "medical_histories"  ("archivedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_medical_histories_patientId" ON "medical_histories"  ("patientId") `);
        await queryRunner.query(`ALTER TABLE "time_slots" ADD CONSTRAINT "CHK_time_slots_capacity" CHECK ("maxCapacity" > 0 AND "currentBookings" >= 0)`);
        await queryRunner.query(`ALTER TABLE "treatments" ADD CONSTRAINT "CHK_treatments_total_sessions" CHECK ("totalSessions" > 0)`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "CHK_appointments_status" CHECK ("status" IN ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'))`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_7f46f5b4f42dcc5ac08c36fa969" FOREIGN KEY ("attendedByProfessionalId") REFERENCES "professionals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "clinical_notes" ADD CONSTRAINT "FK_f3aad3f611d98765f4c30adba9f" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "clinical_notes" ADD CONSTRAINT "FK_51fa1a05c162fea73f4db767dd7" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "treatment_sessions" ADD CONSTRAINT "FK_33f955669add73c7b94256cdc31" FOREIGN KEY ("treatmentId") REFERENCES "treatments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "treatment_sessions" DROP CONSTRAINT "FK_33f955669add73c7b94256cdc31"`);
        await queryRunner.query(`ALTER TABLE "clinical_notes" DROP CONSTRAINT "FK_51fa1a05c162fea73f4db767dd7"`);
        await queryRunner.query(`ALTER TABLE "clinical_notes" DROP CONSTRAINT "FK_f3aad3f611d98765f4c30adba9f"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_7f46f5b4f42dcc5ac08c36fa969"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "CHK_appointments_status"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP CONSTRAINT "CHK_treatments_total_sessions"`);
        await queryRunner.query(`ALTER TABLE "time_slots" DROP CONSTRAINT "CHK_time_slots_capacity"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_medical_histories_patientId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_medical_histories_archivedAt"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_appointments_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_appointments_timeSlotId_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_appointments_patientId_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_appointments_professionalId_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_treatments_patientId_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_treatments_professionalId_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_time_slots_status"`);
        await queryRunner.query(`ALTER TABLE "medical_histories" DROP COLUMN "archivedByUserId"`);
        await queryRunner.query(`ALTER TABLE "medical_histories" DROP COLUMN "archivedAt"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "reminderSentAt"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "notes"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "rescheduledByUserId"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "rescheduledAt"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "noShowAt"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "cancellationReason"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "cancelledByUserId"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "cancelledAt"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "completedAt"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "confirmedAt"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "attendedByProfessionalId"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN "endDate"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN "startDate"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN "status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_treatment_sessions_treatmentId_sessionNumber"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_treatment_sessions_appointmentId"`);
        await queryRunner.query(`DROP TABLE "treatment_sessions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_clinical_notes_patientId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_clinical_notes_professionalId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_clinical_notes_signedAt"`);
        await queryRunner.query(`DROP TABLE "clinical_notes"`);
    }

}
