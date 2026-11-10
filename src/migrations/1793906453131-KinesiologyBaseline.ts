import { MigrationInterface, QueryRunner } from "typeorm";

export class KinesiologyBaseline1793906453131 implements MigrationInterface {
    name = 'KinesiologyBaseline1793906453131'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "health_insurances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "coverageDetails" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ea672bb1dc10675ffc7790c4ff4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL DEFAULT '', "role" character varying NOT NULL DEFAULT 'PATIENT', "roles" text, "status" character varying NOT NULL DEFAULT 'ACTIVE', "activationTokenHash" character varying(64), "activationTokenExpiresAt" TIMESTAMP WITH TIME ZONE, "tokenVersion" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_users_activationTokenHash" ON "users"  ("activationTokenHash") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_users_email_lower" ON "users" (lower("email"))`);
        await queryRunner.query(`CREATE TABLE "persons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "firstName" character varying(100) NOT NULL, "lastName" character varying(100) NOT NULL, "documentId" character varying(20) NOT NULL, "birthDate" date, "gender" character varying NOT NULL DEFAULT 'NOT_SPECIFIED', "phone" character varying(20), "email" character varying(100), "address" character varying(250), "emergencyContactName" character varying(200), "emergencyContactPhone" character varying(20), "userId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_956b4bda46e6ac6a95e5ce6c455" UNIQUE ("documentId"), CONSTRAINT "UQ_928155276ca8852f3c440cc2b2c" UNIQUE ("email"), CONSTRAINT "REL_e180e344d1f7b97f74b8137ace" UNIQUE ("userId"), CONSTRAINT "PK_74278d8812a049233ce41440ac7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_persons_email_lower" ON "persons" (lower("email")) WHERE "email" IS NOT NULL`);
        await queryRunner.query(`CREATE TABLE "patients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "personId" uuid NOT NULL, "obraSocialId" uuid, "prepagaId" uuid, "healthInsuranceId" uuid, "clinicId" uuid, CONSTRAINT "REL_9eef9a10382bc674937ebd46b9" UNIQUE ("personId"), CONSTRAINT "PK_a7f0b9fcbb3469d5ec0b0aceaa7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "professionals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "personId" uuid NOT NULL, "specialty" character varying NOT NULL, "licenseNumber" character varying(50), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_080f59e9e52ac5f07957987d79" UNIQUE ("personId"), CONSTRAINT "PK_d7dc8473b49fcd938def2799387" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_professionals_licenseNumber" ON "professionals"  ("licenseNumber") `);
        await queryRunner.query(`CREATE TABLE "resources" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "type" character varying NOT NULL, "isAvailable" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_632484ab9dff41bba94f9b7c85e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "time_slots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "agendaId" uuid, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "maxCapacity" integer NOT NULL DEFAULT '6', "currentBookings" integer NOT NULL DEFAULT '0', "status" character varying NOT NULL DEFAULT 'AVAILABLE', "weeklyScheduleId" uuid, "doctorScheduleTemplateId" uuid, CONSTRAINT "PK_f87c73d8648c3f3f297adba3cb8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1bda71e0aec9e15e6c96518676" ON "time_slots"  ("agendaId", "startTime") `);
        await queryRunner.query(`CREATE TABLE "treatments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "description" character varying NOT NULL, "totalSessions" integer NOT NULL, "patientId" uuid, "prescribingProfessionalId" uuid, CONSTRAINT "PK_133f26d52c70b9fa3c2dbb3c89e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "appointments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" character varying NOT NULL DEFAULT 'SCHEDULED', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "patientId" uuid, "professionalId" uuid, "resourceId" uuid, "timeSlotId" uuid, "treatmentId" uuid, CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_appointments_timeSlotId" ON "appointments"  ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_appointments_professionalId" ON "appointments"  ("professionalId") `);
        await queryRunner.query(`CREATE INDEX "IDX_appointments_patientId" ON "appointments"  ("patientId") `);
        await queryRunner.query(`CREATE TABLE "weekly_schedules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dayOfWeek" integer NOT NULL, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "slotDurationMinutes" integer NOT NULL DEFAULT '60', "maxCapacityPerSlot" integer NOT NULL DEFAULT '1', "clinicId" uuid, CONSTRAINT "PK_c14aa04ae270430a6eb8444108c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "medical_histories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "medicalRecordNumber" character varying(50), "diagnosis" text, "referringDoctor" character varying(200), "medicalReferralDocument" character varying(255), "medicalHistory" text, "patientId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_97a7712fb95aef0ba080dad357" UNIQUE ("patientId"), CONSTRAINT "PK_8b0170de8abb52639e20c046533" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "token_blacklist" ("token" character varying(1024) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_8c2ca80e62a4a178870aa9e7a0e" PRIMARY KEY ("token"))`);
        await queryRunner.query(`CREATE INDEX "IDX_token_blacklist_expiresAt" ON "token_blacklist"  ("expiresAt") `);
        await queryRunner.query(`CREATE TABLE "clinics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, CONSTRAINT "PK_5513b659e4d12b01a8ab3956abc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "daily_agendas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "professionalId" uuid NOT NULL, "date" date NOT NULL, CONSTRAINT "PK_d4ecdf1625423da52b8d4fae292" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_890874376118305e093976debd" ON "daily_agendas"  ("professionalId", "date") `);
        await queryRunner.query(`CREATE TABLE "doctor_schedule_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dayOfWeek" integer NOT NULL, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "slotDurationMinutes" integer NOT NULL DEFAULT '60', "maxCapacityPerSlot" integer NOT NULL DEFAULT '1', "professionalId" uuid NOT NULL, "clinicId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_def0a8b35a5cffb27cd334d1b70" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "holidays" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" date NOT NULL, "type" character varying NOT NULL DEFAULT 'TOTAL', "partialStartTime" TIME, "partialEndTime" TIME, "clinicId" uuid, CONSTRAINT "UQ_40dfddee0c0d7125c767d8962b1" UNIQUE ("date"), CONSTRAINT "PK_3646bdd4c3817d954d830881dfe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "persons" ADD CONSTRAINT "FK_e180e344d1f7b97f74b8137aced" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "FK_9eef9a10382bc674937ebd46b99" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "FK_8c1bd7a7b8290f656c7a87cea3c" FOREIGN KEY ("obraSocialId") REFERENCES "health_insurances"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "FK_0e9f3a4bee55334cba7cd4c91a8" FOREIGN KEY ("prepagaId") REFERENCES "health_insurances"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "FK_749cc6b440f24ddfcbb47ec9fce" FOREIGN KEY ("healthInsuranceId") REFERENCES "health_insurances"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "FK_89b992130aacacc72429610bbd7" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "professionals" ADD CONSTRAINT "FK_080f59e9e52ac5f07957987d796" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "time_slots" ADD CONSTRAINT "FK_acac9d897e3766e0f45dd68513a" FOREIGN KEY ("agendaId") REFERENCES "daily_agendas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "time_slots" ADD CONSTRAINT "FK_b104e174be6a19d8d0967f72015" FOREIGN KEY ("weeklyScheduleId") REFERENCES "weekly_schedules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "time_slots" ADD CONSTRAINT "FK_bef31f719362ff44ca7cd26bd2b" FOREIGN KEY ("doctorScheduleTemplateId") REFERENCES "doctor_schedule_templates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "treatments" ADD CONSTRAINT "FK_dd2c48032242b38bc27aa032702" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "treatments" ADD CONSTRAINT "FK_1c1a165953e4e2273beb18b02ba" FOREIGN KEY ("prescribingProfessionalId") REFERENCES "professionals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_13c2e57cb81b44f062ba24df57d" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_9daaaa6d5ad58d503555ad554ca" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_9b623fcf3c04296ffbdf658bc31" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_1b351bdfbd715acbd0619199676" FOREIGN KEY ("timeSlotId") REFERENCES "time_slots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_e12192881c5d7336e0de7811b65" FOREIGN KEY ("treatmentId") REFERENCES "treatments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "weekly_schedules" ADD CONSTRAINT "FK_611cce550beaafd30686c26be07" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "medical_histories" ADD CONSTRAINT "FK_97a7712fb95aef0ba080dad3577" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "daily_agendas" ADD CONSTRAINT "FK_47b72c6327ba04e04165f90e122" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "doctor_schedule_templates" ADD CONSTRAINT "FK_4de27fda6690f7d14e9882bad84" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "doctor_schedule_templates" ADD CONSTRAINT "FK_e6858daaf03e985424237467b3d" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "holidays" ADD CONSTRAINT "FK_ae1f86fcd951e9691326d5859ee" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "holidays" DROP CONSTRAINT "FK_ae1f86fcd951e9691326d5859ee"`);
        await queryRunner.query(`ALTER TABLE "doctor_schedule_templates" DROP CONSTRAINT "FK_e6858daaf03e985424237467b3d"`);
        await queryRunner.query(`ALTER TABLE "doctor_schedule_templates" DROP CONSTRAINT "FK_4de27fda6690f7d14e9882bad84"`);
        await queryRunner.query(`ALTER TABLE "daily_agendas" DROP CONSTRAINT "FK_47b72c6327ba04e04165f90e122"`);
        await queryRunner.query(`ALTER TABLE "medical_histories" DROP CONSTRAINT "FK_97a7712fb95aef0ba080dad3577"`);
        await queryRunner.query(`ALTER TABLE "weekly_schedules" DROP CONSTRAINT "FK_611cce550beaafd30686c26be07"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_e12192881c5d7336e0de7811b65"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_1b351bdfbd715acbd0619199676"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_9b623fcf3c04296ffbdf658bc31"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_9daaaa6d5ad58d503555ad554ca"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_13c2e57cb81b44f062ba24df57d"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP CONSTRAINT "FK_1c1a165953e4e2273beb18b02ba"`);
        await queryRunner.query(`ALTER TABLE "treatments" DROP CONSTRAINT "FK_dd2c48032242b38bc27aa032702"`);
        await queryRunner.query(`ALTER TABLE "time_slots" DROP CONSTRAINT "FK_bef31f719362ff44ca7cd26bd2b"`);
        await queryRunner.query(`ALTER TABLE "time_slots" DROP CONSTRAINT "FK_b104e174be6a19d8d0967f72015"`);
        await queryRunner.query(`ALTER TABLE "time_slots" DROP CONSTRAINT "FK_acac9d897e3766e0f45dd68513a"`);
        await queryRunner.query(`ALTER TABLE "professionals" DROP CONSTRAINT "FK_080f59e9e52ac5f07957987d796"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "FK_89b992130aacacc72429610bbd7"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "FK_749cc6b440f24ddfcbb47ec9fce"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "FK_0e9f3a4bee55334cba7cd4c91a8"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "FK_8c1bd7a7b8290f656c7a87cea3c"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "FK_9eef9a10382bc674937ebd46b99"`);
        await queryRunner.query(`ALTER TABLE "persons" DROP CONSTRAINT "FK_e180e344d1f7b97f74b8137aced"`);
        await queryRunner.query(`DROP TABLE "holidays"`);
        await queryRunner.query(`DROP TABLE "doctor_schedule_templates"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_890874376118305e093976debd"`);
        await queryRunner.query(`DROP TABLE "daily_agendas"`);
        await queryRunner.query(`DROP TABLE "clinics"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_token_blacklist_expiresAt"`);
        await queryRunner.query(`DROP TABLE "token_blacklist"`);
        await queryRunner.query(`DROP TABLE "medical_histories"`);
        await queryRunner.query(`DROP TABLE "weekly_schedules"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_appointments_patientId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_appointments_professionalId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_appointments_timeSlotId"`);
        await queryRunner.query(`DROP TABLE "appointments"`);
        await queryRunner.query(`DROP TABLE "treatments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1bda71e0aec9e15e6c96518676"`);
        await queryRunner.query(`DROP TABLE "time_slots"`);
        await queryRunner.query(`DROP TABLE "resources"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_professionals_licenseNumber"`);
        await queryRunner.query(`DROP TABLE "professionals"`);
        await queryRunner.query(`DROP TABLE "patients"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_persons_email_lower"`);
        await queryRunner.query(`DROP TABLE "persons"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_users_email_lower"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_users_activationTokenHash"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "health_insurances"`);
    }

}
