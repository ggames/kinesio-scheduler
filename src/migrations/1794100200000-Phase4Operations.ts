import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase4Operations1794100200000 implements MigrationInterface {
    name = 'Phase4Operations1794100200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "cron_locks" (
            "name" character varying(128) NOT NULL,
            "lockedUntil" TIMESTAMP WITH TIME ZONE NOT NULL,
            "lockedBy" character varying(256) NOT NULL,
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            CONSTRAINT "PK_cron_locks_name" PRIMARY KEY ("name")
        )`);

        await queryRunner.query(`CREATE TABLE "notification_preferences" (
            "userId" uuid NOT NULL,
            "emailEnabled" boolean NOT NULL DEFAULT true,
            "appointmentReminders" boolean NOT NULL DEFAULT true,
            "appointmentChanges" boolean NOT NULL DEFAULT true,
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            CONSTRAINT "PK_notification_preferences_userId" PRIMARY KEY ("userId")
        )`);

        await queryRunner.query(`CREATE TABLE "idempotency_keys" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "userId" uuid NOT NULL,
            "key" character varying(128) NOT NULL,
            "scope" character varying(128) NOT NULL,
            "requestHash" character varying(64) NOT NULL,
            "statusCode" integer NOT NULL DEFAULT 0,
            "response" jsonb,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
            CONSTRAINT "PK_idempotency_keys_id" PRIMARY KEY ("id")
        )`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_idempotency_keys_user_key_scope" ON "idempotency_keys" ("userId", "key", "scope")`);
        await queryRunner.query(`CREATE INDEX "IDX_idempotency_keys_expiresAt" ON "idempotency_keys" ("expiresAt")`);

        await queryRunner.query(`CREATE TABLE "rate_limit_buckets" (
            "key" character varying(256) NOT NULL,
            "count" integer NOT NULL DEFAULT 0,
            "resetAt" TIMESTAMP WITH TIME ZONE NOT NULL,
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            CONSTRAINT "PK_rate_limit_buckets_key" PRIMARY KEY ("key")
        )`);

        await queryRunner.query(`CREATE INDEX "IDX_appointments_professionalId_patientId" ON "appointments" ("professionalId", "patientId")`);
        await queryRunner.query(`CREATE INDEX "IDX_treatments_professionalId_patientId" ON "treatments" ("prescribingProfessionalId", "patientId")`);
        await queryRunner.query(`CREATE INDEX "IDX_email_outbox_sentAt" ON "email_outbox" ("sentAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_email_outbox_sentAt"`);
        await queryRunner.query(`DROP INDEX "IDX_treatments_professionalId_patientId"`);
        await queryRunner.query(`DROP INDEX "IDX_appointments_professionalId_patientId"`);
        await queryRunner.query(`DROP TABLE "rate_limit_buckets"`);
        await queryRunner.query(`DROP INDEX "IDX_idempotency_keys_expiresAt"`);
        await queryRunner.query(`DROP INDEX "UQ_idempotency_keys_user_key_scope"`);
        await queryRunner.query(`DROP TABLE "idempotency_keys"`);
        await queryRunner.query(`DROP TABLE "notification_preferences"`);
        await queryRunner.query(`DROP TABLE "cron_locks"`);
    }

}
