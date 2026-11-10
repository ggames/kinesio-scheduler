import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase2Security1793924368232 implements MigrationInterface {
    name = 'Phase2Security1793924368232'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "login_attempts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "emailHash" character varying(64) NOT NULL, "failedAttempts" integer NOT NULL DEFAULT '0', "firstFailedAt" TIMESTAMP WITH TIME ZONE, "lockedUntil" TIMESTAMP WITH TIME ZONE, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_070e613c8f768b1a70742705c5b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_login_attempts_emailHash" ON "login_attempts"  ("emailHash") `);
        await queryRunner.query(`CREATE TABLE "email_outbox" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "to" character varying(320) NOT NULL, "template" character varying(64) NOT NULL, "payload" jsonb NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'PENDING', "attempts" integer NOT NULL DEFAULT '0', "nextAttemptAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "sentAt" TIMESTAMP WITH TIME ZONE, "lastError" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b6fbfc201f705fbf1ac87bd7197" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_email_outbox_status_nextAttemptAt" ON "email_outbox"  ("status", "nextAttemptAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_email_outbox_status_nextAttemptAt"`);
        await queryRunner.query(`DROP TABLE "email_outbox"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_login_attempts_emailHash"`);
        await queryRunner.query(`DROP TABLE "login_attempts"`);
    }

}
