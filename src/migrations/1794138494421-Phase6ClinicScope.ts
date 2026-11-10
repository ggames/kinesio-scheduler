import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase6ClinicScope1794138494421 implements MigrationInterface {
    name = 'Phase6ClinicScope1794138494421'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "clinicId" uuid`);
        await queryRunner.query(`ALTER TABLE "clinical_attachments" ADD "clinicId" uuid`);
        await queryRunner.query(`ALTER TABLE "clinical_notes" ADD "clinicId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_users_clinicId" ON "users"  ("clinicId") `);
        await queryRunner.query(`CREATE INDEX "IDX_clinical_attachments_clinicId" ON "clinical_attachments"  ("clinicId") `);
        await queryRunner.query(`CREATE INDEX "IDX_clinical_notes_clinicId" ON "clinical_notes"  ("clinicId") `);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_edb259d369bd38b553cf10e04bc" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "clinical_attachments" ADD CONSTRAINT "FK_f9495569a33e72ac998510ac55b" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "clinical_notes" ADD CONSTRAINT "FK_bf8344b8e9262a4eaa26068077d" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        // Ensure at least one clinic exists for backfill.
        await queryRunner.query(`INSERT INTO "clinics" ("name") SELECT 'Clínica Principal' WHERE NOT EXISTS (SELECT 1 FROM "clinics")`);

        // Backfill clinicId from the patient when possible.
        await queryRunner.query(`UPDATE "appointments" a SET "clinicId" = p."clinicId" FROM "patients" p WHERE a."patientId" = p."id" AND a."clinicId" IS NULL AND p."clinicId" IS NOT NULL`);
        await queryRunner.query(`UPDATE "treatments" t SET "clinicId" = p."clinicId" FROM "patients" p WHERE t."patientId" = p."id" AND t."clinicId" IS NULL AND p."clinicId" IS NOT NULL`);
        await queryRunner.query(`UPDATE "clinical_notes" n SET "clinicId" = p."clinicId" FROM "patients" p WHERE n."patientId" = p."id" AND n."clinicId" IS NULL AND p."clinicId" IS NOT NULL`);
        await queryRunner.query(`UPDATE "clinical_attachments" a SET "clinicId" = p."clinicId" FROM "patients" p WHERE a."patientId" = p."id" AND a."clinicId" IS NULL AND p."clinicId" IS NOT NULL`);

        // Fallback to the default clinic for orphan records.
        await queryRunner.query(`UPDATE "appointments" SET "clinicId" = (SELECT id FROM "clinics" ORDER BY name ASC LIMIT 1) WHERE "clinicId" IS NULL`);
        await queryRunner.query(`UPDATE "treatments" SET "clinicId" = (SELECT id FROM "clinics" ORDER BY name ASC LIMIT 1) WHERE "clinicId" IS NULL`);
        await queryRunner.query(`UPDATE "clinical_notes" SET "clinicId" = (SELECT id FROM "clinics" ORDER BY name ASC LIMIT 1) WHERE "clinicId" IS NULL`);
        await queryRunner.query(`UPDATE "clinical_attachments" SET "clinicId" = (SELECT id FROM "clinics" ORDER BY name ASC LIMIT 1) WHERE "clinicId" IS NULL`);

        await queryRunner.query(`ALTER TABLE "appointments" ALTER COLUMN "clinicId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "treatments" ALTER COLUMN "clinicId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clinical_notes" ALTER COLUMN "clinicId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clinical_attachments" ALTER COLUMN "clinicId" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {

        await queryRunner.query(`ALTER TABLE "clinical_attachments" ALTER COLUMN "clinicId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clinical_notes" ALTER COLUMN "clinicId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "treatments" ALTER COLUMN "clinicId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "appointments" ALTER COLUMN "clinicId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "clinical_notes" DROP CONSTRAINT "FK_bf8344b8e9262a4eaa26068077d"`);
        await queryRunner.query(`ALTER TABLE "clinical_attachments" DROP CONSTRAINT "FK_f9495569a33e72ac998510ac55b"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_edb259d369bd38b553cf10e04bc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_clinical_notes_clinicId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_clinical_attachments_clinicId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_users_clinicId"`);
        await queryRunner.query(`ALTER TABLE "clinical_notes" DROP COLUMN "clinicId"`);
        await queryRunner.query(`ALTER TABLE "clinical_attachments" DROP COLUMN "clinicId"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "clinicId"`);
    }

}
