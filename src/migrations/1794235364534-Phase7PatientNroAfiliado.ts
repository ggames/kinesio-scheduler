import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase7PatientNroAfiliado1794235364534 implements MigrationInterface {
    name = 'Phase7PatientNroAfiliado1794235364534'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patients" ADD "nroAfiliado" character varying(100)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "nroAfiliado"`);
    }

}
