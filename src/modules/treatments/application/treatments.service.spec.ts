import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TreatmentsService } from './treatments.service';
import { TreatmentStatus } from '../domain/treatment.entity';
import { TreatmentSessionStatus } from '../domain/treatment-session.entity';

const adminUser = { userId: 'admin-1', role: 'ADMIN', roles: ['ADMIN'] } as any;
const staffUser = { userId: 'staff-1', role: 'STAFF', roles: ['STAFF'] } as any;
const patientUser = {
  userId: 'patient-user',
  role: 'PATIENT',
  roles: ['PATIENT'],
} as any;

function buildRepo() {
  return {
    create: (jest.fn() as any).mockImplementation((value: any) => ({ ...value })),
    save: (jest.fn() as any).mockImplementation(async (value: any) => ({
      id: 'treatment-1',
      ...value,
    })),
    find: (jest.fn() as any).mockResolvedValue([]),
    findOne: (jest.fn() as any).mockResolvedValue(null),
    manager: {
      findOne: (jest.fn() as any).mockResolvedValue({
        id: 'patient-1',
        clinicId: 'clinic-1',
      }),
    },
  };
}

function buildService(repo: any, sessionRepo: any, authorization: any, audit: any) {
  return new TreatmentsService(repo, sessionRepo, authorization, audit);
}

function baseDeps() {
  return {
    authorization: {
      assertCanWriteClinicalRecord: (jest.fn() as any).mockResolvedValue(undefined),
      assertCanAccessPatient: (jest.fn() as any).mockResolvedValue(undefined),
      getProfessionalIdForUser: (jest.fn() as any).mockResolvedValue(null),
      getPatientIdForUser: (jest.fn() as any).mockResolvedValue('patient-1'),
    },
    audit: { record: (jest.fn() as any).mockResolvedValue(undefined) },
    sessionRepo: { find: (jest.fn() as any).mockResolvedValue([]) },
  };
}

const createDto = {
  patientId: 'patient-1',
  professionalId: 'prof-1',
  description: 'Rehabilitación',
  totalSessions: 10,
};

describe('TreatmentsService', () => {
  describe('create', () => {
    it('hereda la clínica del paciente cuando no se envía clinicId', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      const service = buildService(repo, sessionRepo, authorization, audit);

      const result: any = await service.create(
        { ...createDto, startDate: '2026-01-01' },
        adminUser,
      );

      expect(result.clinicId).toBe('clinic-1');
      expect(result.status).toBe(TreatmentStatus.ACTIVE);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'TREATMENT_CREATED' }),
      );
    });

    it('respeta el clinicId explícito del DTO', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      const service = buildService(repo, sessionRepo, authorization, audit);

      const result: any = await service.create(
        { ...createDto, clinicId: 'clinic-2' },
        adminUser,
      );

      expect(result.clinicId).toBe('clinic-2');
    });

    it('rechaza crear un tratamiento a nombre de otro profesional', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      authorization.getProfessionalIdForUser.mockResolvedValue('other-prof');
      const service = buildService(repo, sessionRepo, authorization, audit);

      await expect(
        service.create({ ...createDto }, staffUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('devuelve todos los tratamientos para ADMIN', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      const service = buildService(repo, sessionRepo, authorization, audit);

      await service.findAll(adminUser);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
    });

    it('filtra por profesional cuando el usuario tiene perfil profesional', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      authorization.getProfessionalIdForUser.mockResolvedValue('prof-1');
      const service = buildService(repo, sessionRepo, authorization, audit);

      await service.findAll(staffUser);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { prescribingProfessional: { id: 'prof-1' } } }),
      );
    });

    it('devuelve todos los tratamientos para STAFF sin perfil profesional', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      const service = buildService(repo, sessionRepo, authorization, audit);

      await service.findAll(staffUser);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
    });

    it('filtra por paciente para usuarios PATIENT', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      const service = buildService(repo, sessionRepo, authorization, audit);

      await service.findAll(patientUser);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { patient: { id: 'patient-1' } } }),
      );
    });

    it('filtra por clínica en el listado', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      const service = buildService(repo, sessionRepo, authorization, audit);

      await service.findAll(adminUser, 'clinic-a');

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clinicId: 'clinic-a' } }),
      );
    });

    it('devuelve lista vacía si el paciente no tiene perfil', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      authorization.getPatientIdForUser.mockResolvedValue(null);
      const service = buildService(repo, sessionRepo, authorization, audit);

      const result = await service.findAll(patientUser);

      expect(result).toEqual([]);
      expect(repo.find).not.toHaveBeenCalled();
    });
  });

  describe('findOne / findSessions', () => {
    it('lanza NotFoundException si el tratamiento no existe', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      const service = buildService(repo, sessionRepo, authorization, audit);

      await expect(service.findOne('missing', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('valida acceso y retorna sesiones ordenadas', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      repo.findOne.mockResolvedValue({ id: 'treatment-1', patient: { id: 'patient-1' } });
      sessionRepo.find.mockResolvedValue([{ id: 's1' }]);
      const service = buildService(repo, sessionRepo, authorization, audit);

      const result = await service.findSessions('treatment-1', adminUser);

      expect(authorization.assertCanAccessPatient).toHaveBeenCalledWith(
        adminUser,
        'patient-1',
      );
      expect(result).toEqual([{ id: 's1' }]);
    });
  });

  describe('recordCompletedSession', () => {
    function buildManager(overrides: Record<string, any> = {}): any {
      return {
        findOne: (jest.fn() as any).mockImplementation(
          async (_entity: any, query: any) => {
            if (query?.where?.appointmentId) return null;
            return {
              id: 'treatment-1',
              status: TreatmentStatus.ACTIVE,
              totalSessions: 10,
            };
          },
        ),
        count: (jest.fn() as any).mockResolvedValue(0),
        create: (jest.fn() as any).mockImplementation((_e: any, v: any) => ({ ...v })),
        save: (jest.fn() as any).mockImplementation(
          async (_entity: any, value: any) => value,
        ),
        ...overrides,
      };
    }

    const appointment = (treatmentId?: string) =>
      ({ id: 'appt-1', treatment: treatmentId ? { id: treatmentId } : undefined }) as any;

    it('retorna null si el turno no tiene tratamiento', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      const service = buildService(repo, sessionRepo, authorization, audit);

      const result = await service.recordCompletedSession(buildManager(), appointment());

      expect(result).toEqual({ session: null, treatmentCompleted: false });
    });

    it('retorna la sesión existente sin duplicarla', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      const service = buildService(repo, sessionRepo, authorization, audit);
      const existing = { id: 's1' };
      const manager = buildManager({
        findOne: (jest.fn() as any).mockResolvedValue(existing),
      });

      const result = await service.recordCompletedSession(
        manager,
        appointment('treatment-1'),
      );

      expect(result.session).toBe(existing);
    });

    it('lanza NotFound si el tratamiento no existe', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      const service = buildService(repo, sessionRepo, authorization, audit);
      const manager = buildManager({
        findOne: (jest.fn() as any)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
      });

      await expect(
        service.recordCompletedSession(manager, appointment('treatment-1')),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza Conflict si el tratamiento no está activo', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      const service = buildService(repo, sessionRepo, authorization, audit);
      const manager = buildManager({
        findOne: (jest.fn() as any)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'treatment-1',
            status: TreatmentStatus.COMPLETED,
            totalSessions: 10,
          }),
      });

      await expect(
        service.recordCompletedSession(manager, appointment('treatment-1')),
      ).rejects.toThrow(ConflictException);
    });

    it('lanza Conflict al alcanzar el máximo de sesiones', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      const service = buildService(repo, sessionRepo, authorization, audit);
      const manager = buildManager({ count: (jest.fn() as any).mockResolvedValue(10) });

      await expect(
        service.recordCompletedSession(manager, appointment('treatment-1')),
      ).rejects.toThrow(ConflictException);
    });

    it('completa el tratamiento al registrar la última sesión', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      const service = buildService(repo, sessionRepo, authorization, audit);
      const manager = buildManager({
        count: (jest.fn() as any).mockResolvedValue(9),
      });

      const result = await service.recordCompletedSession(
        manager,
        appointment('treatment-1'),
        'Buena evolución',
      );

      expect(result.treatmentCompleted).toBe(true);
      expect(result.session!.sessionNumber).toBe(10);
      expect(result.session!.status).toBe(TreatmentSessionStatus.COMPLETED);
      expect(manager.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: TreatmentStatus.COMPLETED }),
      );
    });

    it('registra una sesión intermedia sin completar el tratamiento', async () => {
      const repo = buildRepo();
      const { authorization, audit, sessionRepo } = baseDeps();
      const service = buildService(repo, sessionRepo, authorization, audit);
      const manager = buildManager();

      const result = await service.recordCompletedSession(
        manager,
        appointment('treatment-1'),
      );

      expect(result.treatmentCompleted).toBe(false);
      expect(result.session!.sessionNumber).toBe(1);
    });
  });
});
