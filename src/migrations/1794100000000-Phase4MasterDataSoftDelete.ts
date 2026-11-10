import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase4MasterDataSoftDelete1794100000000 implements MigrationInterface {
    name = 'Phase4MasterDataSoftDelete1794100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patients" ADD "archivedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "patients" ADD "archivedByUserId" uuid`);
        await queryRunner.query(`ALTER TABLE "patients" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "patients" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`CREATE INDEX "IDX_patients_archivedAt" ON "patients" ("archivedAt")`);

        await queryRunner.query(`ALTER TABLE "professionals" ADD "isActive" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "professionals" ADD "deactivatedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "professionals" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`CREATE INDEX "IDX_professionals_isActive" ON "professionals" ("isActive")`);

        await queryRunner.query(`ALTER TABLE "persons" ADD "archivedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "persons" ADD "archivedByUserId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_persons_archivedAt" ON "persons" ("archivedAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_persons_archivedAt"`);
        await queryRunner.query(`ALTER TABLE "persons" DROP COLUMN "archivedByUserId"`);
        await queryRunner.query(`ALTER TABLE "persons" DROP COLUMN "archivedAt"`);

        await queryRunner.query(`DROP INDEX "IDX_professionals_isActive"`);
        await queryRunner.query(`ALTER TABLE "professionals" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "professionals" DROP COLUMN "deactivatedAt"`);
        await queryRunner.query(`ALTER TABLE "professionals" DROP COLUMN "isActive"`);

        await queryRunner.query(`DROP INDEX "IDX_patients_archivedAt"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "archivedByUserId"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "archivedAt"`);
    }

}
