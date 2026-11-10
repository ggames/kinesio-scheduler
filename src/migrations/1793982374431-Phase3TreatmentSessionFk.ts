import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase3TreatmentSessionFk1793982374431 implements MigrationInterface {
    name = 'Phase3TreatmentSessionFk1793982374431'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "treatment_sessions" ADD CONSTRAINT "FK_84fd1c09a39099c4219899d1477" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "treatment_sessions" DROP CONSTRAINT "FK_84fd1c09a39099c4219899d1477"`);
    }

}
