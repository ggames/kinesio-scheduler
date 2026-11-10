import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase5PasswordReset1794100300000 implements MigrationInterface {
    name = 'Phase5PasswordReset1794100300000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "password_reset_tokens" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "userId" uuid NOT NULL,
            "tokenHash" character varying(64) NOT NULL,
            "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
            "used" boolean NOT NULL DEFAULT false,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            CONSTRAINT "PK_password_reset_tokens_id" PRIMARY KEY ("id")
        )`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_pw_reset_tokens_tokenHash" ON "password_reset_tokens" ("tokenHash")`);
        await queryRunner.query(`CREATE INDEX "IDX_pw_reset_tokens_userId" ON "password_reset_tokens" ("userId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_pw_reset_tokens_userId"`);
        await queryRunner.query(`DROP INDEX "IDX_pw_reset_tokens_tokenHash"`);
        await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    }
}
