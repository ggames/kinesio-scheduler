import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppModule } from './../src/app.module';
import { CalendarGeneratorService } from './../src/modules/agenda/application/services/calendar-generator.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Evita sembrar/generar 60 días de agenda durante el smoke test.
      .overrideProvider(CalendarGeneratorService)
      .useValue({ onModuleInit: async () => undefined })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /health es público y verifica la base de datos', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          status: 'ok',
          database: 'up',
        });
        expect(response.headers['x-request-id']).toBeDefined();
      });
  });

  it('GET /health/ready verifica base de datos y migraciones', () => {
    return request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          status: 'ok',
          database: 'up',
          migrations: 'up',
        });
      });
  });

  it('GET /users requiere autenticación de administrador', () => {
    return request(app.getHttpServer()).get('/users').expect(401);
  });

  it('GET /audit-logs requiere autenticación', () => {
    return request(app.getHttpServer()).get('/audit-logs').expect(401);
  });

  it('GET /privacy/patients/:id/export requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/privacy/patients/00000000-0000-0000-0000-000000000000/export')
      .expect(401);
  });

  it('GET /notifications/preferences requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/notifications/preferences')
      .expect(401);
  });

  it('GET /notifications/outbox requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/notifications/outbox')
      .expect(401);
  });

  it('GET /appointments requiere autenticación', () => {
    return request(app.getHttpServer()).get('/appointments').expect(401);
  });

  it('POST /appointments/:id/complete requiere autenticación', () => {
    return request(app.getHttpServer())
      .patch('/appointments/00000000-0000-0000-0000-000000000000/complete')
      .expect(401);
  });

  it('GET /clinical-notes requiere autenticación', () => {
    return request(app.getHttpServer()).get('/clinical-notes').expect(401);
  });

  it('POST /clinical-notes/:id/sign requiere autenticación', () => {
    return request(app.getHttpServer())
      .post('/clinical-notes/00000000-0000-0000-0000-000000000000/sign')
      .expect(401);
  });

  it('GET /reports/agenda-occupancy requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/reports/agenda-occupancy')
      .expect(401);
  });

  it('GET /reports/treatment-status-summary requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/reports/treatment-status-summary')
      .expect(401);
  });

  it('POST /auth/forgot-password es público y no revela la existencia del email', () => {
    return request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'no-existe-e2e@example.com' })
      .expect(200);
  });

  it('POST /auth/forgot-password valida el email', () => {
    return request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'no-es-email' })
      .expect(400);
  });

  it('POST /auth/reset-password rechaza tokens inválidos', () => {
    return request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'token-invalido-e2e', password: 'NewPassword123' })
      .expect(400);
  });

  it('POST /auth/reset-password valida la contraseña', () => {
    return request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'token-invalido-e2e', password: 'corta' })
      .expect(400);
  });

  it('GET /patients/me requiere autenticación', () => {
    return request(app.getHttpServer()).get('/patients/me').expect(401);
  });

  it('GET /treatments/my requiere autenticación', () => {
    return request(app.getHttpServer()).get('/treatments/my').expect(401);
  });

  it('GET /medical-histories/my requiere autenticación', () => {
    return request(app.getHttpServer()).get('/medical-histories/my').expect(401);
  });

  it('GET /clinical-notes/my requiere autenticación', () => {
    return request(app.getHttpServer()).get('/clinical-notes/my').expect(401);
  });

  it('GET /notifications/mine requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/notifications/mine')
      .expect(401);
  });

  it('GET /attachments requiere autenticación', () => {
    return request(app.getHttpServer())
      .get('/attachments?patientId=00000000-0000-0000-0000-000000000000')
      .expect(401);
  });

  it('aísla pacientes y lecturas entre clínicas', async () => {
    const dataSource = app.get(DataSource);
    const tag = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const password = 'Password123';
    const passwordHash = await bcrypt.hash(password, 10);

    const createdClinicIds: string[] = [];
    const createdUserIds: string[] = [];
    const createdDocuments: string[] = [];
    const createdOutboxIds: string[] = [];

    const createClinic = async (name: string): Promise<string> => {
      const rows = await dataSource.query(
        'INSERT INTO clinics (name) VALUES ($1) RETURNING id',
        [name],
      );
      createdClinicIds.push(rows[0].id);
      return rows[0].id;
    };

    const createClinicAdmin = async (
      clinicId: string,
      email: string,
    ): Promise<string> => {
      const rows = await dataSource.query(
        `INSERT INTO users (email, "passwordHash", role, roles, status, "tokenVersion", "clinicId")
         VALUES ($1, $2, 'CLINIC_ADMIN', 'CLINIC_ADMIN', 'ACTIVE', 0, $3) RETURNING id`,
        [email, passwordHash, clinicId],
      );
      createdUserIds.push(rows[0].id);
      return rows[0].id;
    };

    const login = async (email: string): Promise<string> => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
      return response.body.access_token;
    };

    try {
      const clinicA = await createClinic(`E2E Clinic A ${tag}`);
      const clinicB = await createClinic(`E2E Clinic B ${tag}`);
      const emailA = `clinic-a-${tag}@e2e.test`;
      const emailB = `clinic-b-${tag}@e2e.test`;
      await createClinicAdmin(clinicA, emailA);
      await createClinicAdmin(clinicB, emailB);

      const tokenA = await login(emailA);
      const tokenB = await login(emailB);

      const documentA = `A${tag}`.slice(0, 20);
      const documentB = `B${tag}`.slice(0, 20);
      createdDocuments.push(documentA, documentB);

      const patientA = await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          firstName: 'Paciente',
          lastName: 'Clínica A',
          documentId: documentA,
          clinicId: clinicB,
        })
        .expect(201);

      const patientB = await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          firstName: 'Paciente',
          lastName: 'Clínica B',
          documentId: documentB,
        })
        .expect(201);

      const listA = await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(listA.body.data.map((p: any) => p.id)).toEqual([patientA.body.id]);
      expect(listA.body.data[0].clinicId).toBe(clinicA);

      const listB = await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      expect(listB.body.data.map((p: any) => p.id)).toEqual([patientB.body.id]);

      await request(app.getHttpServer())
        .get(`/patients/${patientB.body.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('X-Clinic-Id', clinicB)
        .expect(403);

      const outboxRows = await dataSource.query(
        `INSERT INTO email_outbox ("to", template, payload, status, "clinicId")
         VALUES ($1, 'welcome', '{}', 'PENDING', $2), ($3, 'welcome', '{}', 'PENDING', $4)
         RETURNING id`,
        [`a-${tag}@e2e.test`, clinicA, `b-${tag}@e2e.test`, clinicB],
      );
      createdOutboxIds.push(...outboxRows.map((row: any) => row.id));

      const outboxA = await request(app.getHttpServer())
        .get('/notifications/outbox?limit=100')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(outboxA.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        outboxA.body.data.every((item: any) => item.clinicId === clinicA),
      ).toBe(true);

      const auditA = await request(app.getHttpServer())
        .get('/audit-logs?limit=100')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(
        auditA.body.data.every((item: any) => item.clinicId === clinicA),
      ).toBe(true);
    } finally {
      if (createdDocuments.length > 0) {
        await dataSource.query(
          'DELETE FROM medical_histories WHERE "patientId" IN (SELECT id FROM patients WHERE "personId" IN (SELECT id FROM persons WHERE "documentId" = ANY($1)))',
          [createdDocuments],
        );
        await dataSource.query(
          'DELETE FROM patients WHERE "personId" IN (SELECT id FROM persons WHERE "documentId" = ANY($1))',
          [createdDocuments],
        );
        await dataSource.query(
          'DELETE FROM persons WHERE "documentId" = ANY($1)',
          [createdDocuments],
        );
      }
      if (createdOutboxIds.length > 0) {
        await dataSource.query('DELETE FROM email_outbox WHERE id = ANY($1)', [
          createdOutboxIds,
        ]);
      }
      if (createdUserIds.length > 0) {
        await dataSource.query('DELETE FROM users WHERE id = ANY($1)', [
          createdUserIds,
        ]);
      }
      if (createdClinicIds.length > 0) {
        await dataSource.query('DELETE FROM clinics WHERE id = ANY($1)', [
          createdClinicIds,
        ]);
      }
    }
  }, 30000);
});

