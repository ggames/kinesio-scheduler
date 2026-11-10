import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase2SessionsAndAudit1793933296951 implements MigrationInterface {
    name = 'Phase2SessionsAndAudit1793933296951'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "eventType" character varying(64) NOT NULL, "actorUserId" uuid, "targetUserId" uuid, "ip" character varying(64), "userAgent" character varying(512), "requestId" character varying(64), "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_audit_logs_actorUserId" ON "audit_logs"  ("actorUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_audit_logs_eventType_createdAt" ON "audit_logs"  ("eventType", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying(64) NOT NULL, "familyId" uuid NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "replacedByTokenId" uuid, "userAgent" character varying(512), "ip" character varying(64), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_familyId" ON "refresh_tokens"  ("familyId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_refresh_tokens_tokenHash" ON "refresh_tokens"  ("tokenHash") `);
        await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_userId" ON "refresh_tokens"  ("userId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_refresh_tokens_userId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_refresh_tokens_tokenHash"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_refresh_tokens_familyId"`);
        await queryRunner.query(`DROP TABLE "refresh_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_eventType_createdAt"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_actorUserId"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
    }

}
