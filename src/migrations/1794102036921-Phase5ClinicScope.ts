import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase5ClinicScope1794102036921 implements MigrationInterface {
    name = 'Phase5ClinicScope1794102036921'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "treatments" ADD "clinicId" uuid`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD "clinicId" uuid`);
        await queryRunner.query(`ALTER TABLE "treatments" ADD CONSTRAINT "FK_0185f070d41ad4e21ea707b4e6a" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_040a7ee2072d45bc98efddf3c02" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_040a7ee2072d45bc98efddf3c02"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP CONSTRAINT "FK_0185f070d41ad4e21ea707b4e6a"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "clinicId"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP COLUMN "clinicId"`);
    }

}
