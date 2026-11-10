import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase6AuditOutboxClinic1794149216064 implements MigrationInterface {
    name = 'Phase6AuditOutboxClinic1794149216064'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD "clinicId" uuid`);
        await queryRunner.query(`ALTER TABLE "email_outbox" ADD "clinicId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_audit_logs_clinicId" ON "audit_logs"  ("clinicId") `);
        await queryRunner.query(`CREATE INDEX "IDX_email_outbox_clinicId" ON "email_outbox"  ("clinicId") `);
        await queryRunner.query(`
            UPDATE "audit_logs" audit
            SET "clinicId" = actor."clinicId"
            FROM "users" actor
            WHERE audit."actorUserId" = actor."id"
              AND audit."clinicId" IS NULL
        `);
        await queryRunner.query(`
            UPDATE "audit_logs" audit
            SET "clinicId" = target."clinicId"
            FROM "users" target
            WHERE audit."targetUserId" = target."id"
              AND audit."clinicId" IS NULL
              AND target."clinicId" IS NOT NULL
        `);
        await queryRunner.query(`
            UPDATE "email_outbox" outbox
            SET "clinicId" = users."clinicId"
            FROM "users"
            WHERE lower(users."email") = lower(outbox."to")
              AND outbox."clinicId" IS NULL
              AND users."clinicId" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_email_outbox_clinicId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_clinicId"`);
        await queryRunner.query(`ALTER TABLE "email_outbox" DROP COLUMN "clinicId"`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "clinicId"`);
    }

}
