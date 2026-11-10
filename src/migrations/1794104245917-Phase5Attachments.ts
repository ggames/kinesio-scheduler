import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase5Attachments1794104245917 implements MigrationInterface {
    name = 'Phase5Attachments1794104245917'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "clinical_attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "patientId" uuid NOT NULL, "appointmentId" uuid, "treatmentId" uuid, "fileName" character varying(255) NOT NULL, "mimeType" character varying(128) NOT NULL, "sizeBytes" integer NOT NULL, "storagePath" character varying(512) NOT NULL, "uploadedByUserId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_37ae0c9093e6b5dcf154a3518b4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_clinical_attachments_patientId" ON "clinical_attachments"  ("patientId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_clinical_attachments_patientId"`);
        await queryRunner.query(`DROP TABLE "clinical_attachments"`);
    }

}
