import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase7Invoices1794240000000 implements MigrationInterface {
    name = 'Phase7Invoices1794240000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "clinicId" uuid, "patientId" uuid NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'ISSUED', "subtotal" numeric(10,2) NOT NULL DEFAULT 0, "taxAmount" numeric(10,2) NOT NULL DEFAULT 0, "total" numeric(10,2) NOT NULL DEFAULT 0, "cae" character varying(100), "caeExpirationAt" timestamptz, "isElectronic" boolean NOT NULL DEFAULT false, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "PK_c4e73cbcd52c9d8c2f84e4c0c81" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_clinicId" ON "invoices" ("clinicId") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_patientId" ON "invoices" ("patientId") `);
        await queryRunner.query(`CREATE INDEX "IDX_invoices_status" ON "invoices" ("status") `);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_clinicId" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_patientId" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "invoice_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoiceId" uuid NOT NULL, "description" character varying(255) NOT NULL, "quantity" integer NOT NULL, "unitPrice" numeric(10,2) NOT NULL, "total" numeric(10,2) NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "PK_f2a1e9b1b7c8d3e4f5a6b7c8d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_invoice_items_invoiceId" ON "invoice_items" ("invoiceId") `);

        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoiceId" uuid NOT NULL, "method" character varying(32) NOT NULL, "amount" numeric(10,2) NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'PENDING', "reference" character varying(100), "createdAt" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "PK_b8a1c2d3e4f5a6b7c8d9e0f1a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_payments_invoiceId" ON "payments" ("invoiceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_payments_status" ON "payments" ("status") `);

        await queryRunner.query(`ALTER TABLE "invoice_items" ADD CONSTRAINT "FK_invoice_items_invoiceId" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_invoiceId" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_invoiceId"`);
        await queryRunner.query(`ALTER TABLE "invoice_items" DROP CONSTRAINT "FK_invoice_items_invoiceId"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_patientId"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_clinicId"`);
        await queryRunner.query(`DROP INDEX "IDX_payments_status"`);
        await queryRunner.query(`DROP INDEX "IDX_payments_invoiceId"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP INDEX "IDX_invoice_items_invoiceId"`);
        await queryRunner.query(`DROP TABLE "invoice_items"`);
        await queryRunner.query(`DROP INDEX "IDX_invoices_status"`);
        await queryRunner.query(`DROP INDEX "IDX_invoices_patientId"`);
        await queryRunner.query(`DROP INDEX "IDX_invoices_clinicId"`);
        await queryRunner.query(`DROP TABLE "invoices"`);
    }
}
