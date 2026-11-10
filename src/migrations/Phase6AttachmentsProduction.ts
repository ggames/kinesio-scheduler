import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase6AttachmentsProduction1794150000000 implements MigrationInterface {
    name = 'Phase6AttachmentsProduction1794150000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clinical_attachments" ADD "checksum" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "clinical_attachments" ADD "storageKey" character varying(512)`);
        await queryRunner.query(`ALTER TABLE "clinical_attachments" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clinical_attachments" DROP COLUMN "deletedAt"`);
        await queryRunner.query(`ALTER TABLE "clinical_attachments" DROP COLUMN "storageKey"`);
        await queryRunner.query(`ALTER TABLE "clinical_attachments" DROP COLUMN "checksum"`);
    }
}
