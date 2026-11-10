import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PatientsService } from './patients.service';

function buildQueryBuilder(result: [any[], number] = [[], 0]) {
  const qb: any = {};
  qb.leftJoinAndSelect = jest.fn(() => qb);
  qb.where = jest.fn(() => qb);
  qb.andWhere = jest.fn(() => qb);
  qb.orderBy = jest.fn(() => qb);
  qb.addOrderBy = jest.fn(() => qb);
  qb.skip = jest.fn(() => qb);
  qb.take = jest.fn(() => qb);
  qb.getManyAndCount = (jest.fn() as any).mockResolvedValue(result);
  return qb;
}

function buildRepo(qb = buildQueryBuilder()) {
  return {
    create: (jest.fn() as any).mockImplementation((value: any) => ({ ...value })),
    save: (jest.fn() as any).mockImplementation(async (value: any) => ({
      id: 'patient-1',
      ...value,
    })),
    findOne: (jest.fn() as any).mockResolvedValue(null),
    update: (jest.fn() as any).mockResolvedValue(undefined),
    createQueryBuilder: (jest.fn() as any).mockReturnValue(qb),
  };
}

function buildPersonRepo() {
  return {
    findOne: (jest.fn() as any).mockResolvedValue(null),
    create: (jest.fn() as any).mockImplementation((value: any) => ({ ...value })),
    save: (jest.fn() as any).mockImplementation(async (value: any) => ({
      id: 'person-1',
      ...value,
    })),
    update: (jest.fn() as any).mockResolvedValue(undefined),
  };
}

function buildDataSource() {
  return {
    transaction: (jest.fn() as any).mockImplementation(async (cb: any) =>
      cb({ update: (jest.fn() as any).mockResolvedValue(undefined) }),
    ),
  };
}

describe('PatientsService', () => {
  let repo: ReturnType<typeof buildRepo>;
  let personRepo: ReturnType<typeof buildPersonRepo>;
  let dataSource: ReturnType<typeof buildDataSource>;
  let service: PatientsService;

  beforeEach(() => {
    repo = buildRepo();
    personRepo = buildPersonRepo();
    dataSource = buildDataSource();
    service = new PatientsService(
      repo as any,
      personRepo as any,
      dataSource as any,
    );
  });

  describe('create', () => {
    it('crea paciente con persona nueva', async () => {
      const result: any = await service.create({
        firstName: 'Juan',
        lastName: 'Pérez',
        documentId: '12345678',
      });

      expect(personRepo.save).toHaveBeenCalled();
      expect(result.personId).toBe('person-1');
    });

    it('reutiliza la persona encontrada por documentId', async () => {
      personRepo.findOne.mockResolvedValue({ id: 'person-9' });

      const result: any = await service.create({
        firstName: 'Juan',
        lastName: 'Pérez',
        documentId: '12345678',
      });

      expect(personRepo.save).not.toHaveBeenCalled();
      expect(result.personId).toBe('person-9');
    });

    it('reutiliza la persona encontrada por personId', async () => {
      personRepo.findOne.mockResolvedValue({ id: 'person-7' });

      const result: any = await service.create({ personId: 'person-7' } as any);

      expect(result.personId).toBe('person-7');
    });
  });

  describe('findAll', () => {
    it('aplica búsqueda, paginación y devuelve metadatos', async () => {
      const qb = buildQueryBuilder([[{ id: 'p1' }], 25]);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ page: 2, limit: 10, search: 'juan' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        { search: '%juan%' },
      );
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result.meta).toMatchObject({
        page: 2,
        limit: 10,
        total: 25,
        pageCount: 3,
        hasNext: true,
        hasPrevious: true,
      });
    });

    it('filtra por clínica cuando hay scope', async () => {
      const qb = buildQueryBuilder([[], 0]);
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({}, 'clinic-a');

      expect(qb.andWhere).toHaveBeenCalledWith('patient.clinicId = :clinicId', {
        clinicId: 'clinic-a',
      });
    });

    it('usa valores por defecto sin filtros', async () => {
      const qb = buildQueryBuilder([[], 0]);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({});

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(result.meta).toMatchObject({ page: 1, limit: 20, total: 0 });
    });
  });

  describe('findOne / findMeByUserId', () => {
    it('lanza NotFound si el paciente no existe', async () => {
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFound si no hay persona para el usuario', async () => {
      await expect(service.findMeByUserId('user-x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza NotFound si la persona no tiene paciente activo', async () => {
      personRepo.findOne.mockResolvedValue({ id: 'person-1' });

      await expect(service.findMeByUserId('user-x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('retorna el paciente activo del usuario autenticado', async () => {
      personRepo.findOne.mockResolvedValue({ id: 'person-1' });
      repo.findOne.mockResolvedValue({ id: 'patient-1' });

      const result = await service.findMeByUserId('user-x');

      expect(result).toEqual({ id: 'patient-1' });
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ personId: 'person-1' }) }),
      );
    });
  });

  describe('update', () => {
    it('actualiza persona y paciente', async () => {
      const existing = { id: 'patient-1', personId: 'person-1', archivedAt: null };
      repo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, person: { firstName: 'Nuevo' } });

      const result = await service.update('patient-1', {
        firstName: 'Nuevo',
        clinicId: 'clinic-1',
      });

      expect(personRepo.update).toHaveBeenCalledWith(
        'person-1',
        expect.objectContaining({ firstName: 'Nuevo' }),
      );
      expect(repo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ clinicId: 'clinic-1' }),
      );
      expect(result).toBeDefined();
    });

    it('rechaza un documento ya usado por otra persona', async () => {
      repo.findOne.mockResolvedValue({ id: 'patient-1', personId: 'person-1' });
      personRepo.findOne.mockResolvedValue({ id: 'person-2' });

      await expect(
        service.update('patient-1', { documentId: '999' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('archive / restore', () => {
    it('archiva paciente y persona en una transacción', async () => {
      const existing = { id: 'patient-1', personId: 'person-1', archivedAt: null };
      repo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, archivedAt: new Date() });

      const result = await service.archive('patient-1', 'admin-1');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.archivedAt).toBeDefined();
    });

    it('rechaza restaurar un paciente no archivado', async () => {
      repo.findOne.mockResolvedValue({ id: 'patient-1', archivedAt: null });

      await expect(service.restore('patient-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('restaura un paciente archivado', async () => {
      repo.findOne
        .mockResolvedValueOnce({ id: 'patient-1', archivedAt: new Date() })
        .mockResolvedValueOnce({ id: 'patient-1', archivedAt: null });

      const result = await service.restore('patient-1');

      expect(result.archivedAt).toBeNull();
    });
  });
});
