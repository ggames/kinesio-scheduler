import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';

function buildQb(result: [any[], number] = [[], 0]) {
  const qb: any = {};
  for (const method of [
    'leftJoinAndSelect',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
    'andWhere',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getManyAndCount = (jest.fn() as any).mockResolvedValue(result);
  return qb;
}

function buildRepo(qb = buildQb()) {
  return {
    create: (jest.fn() as any).mockImplementation((value: any) => ({ ...value })),
    save: (jest.fn() as any).mockImplementation(async (value: any) => ({
      id: 'prof-1',
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

describe('ProfessionalsService', () => {
  let repo: ReturnType<typeof buildRepo>;
  let personRepo: ReturnType<typeof buildPersonRepo>;
  let service: ProfessionalsService;

  beforeEach(() => {
    repo = buildRepo();
    personRepo = buildPersonRepo();
    service = new ProfessionalsService(repo as any, personRepo as any);
  });

  describe('create', () => {
    it('lanza NotFound si personId no existe', async () => {
      await expect(
        service.create({ personId: 'missing' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('reutiliza la persona indicada por personId', async () => {
      personRepo.findOne.mockResolvedValue({ id: 'person-1' });

      const result: any = await service.create({
        personId: 'person-1',
        specialty: 'Kinesiología',
        licenseNumber: 'MP-1',
      } as any);

      expect(result.personId).toBe('person-1');
      expect(personRepo.save).not.toHaveBeenCalled();
    });

    it('reutiliza la persona encontrada por documentId', async () => {
      personRepo.findOne.mockResolvedValue({ id: 'person-2' });

      const result: any = await service.create({
        documentId: '12345678',
        specialty: 'Kinesiología',
        licenseNumber: 'MP-2',
      } as any);

      expect(result.personId).toBe('person-2');
    });

    it('rechaza crear sin persona ni documento', async () => {
      await expect(
        service.create({ specialty: 'Kinesiología' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea una persona nueva cuando no existe', async () => {
      const result: any = await service.create({
        firstName: 'Ana',
        lastName: 'Gómez',
        documentId: '12345678',
        specialty: 'Kinesiología',
        licenseNumber: 'MP-3',
      } as any);

      expect(personRepo.save).toHaveBeenCalled();
      expect(result.personId).toBe('person-1');
    });
  });

  describe('findAll', () => {
    it('filtra activos y aplica búsqueda', async () => {
      const qb = buildQb([[{ id: 'p1' }], 5]);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ search: 'ana', limit: 5 } as any);

      expect(qb.andWhere).toHaveBeenCalledTimes(2);
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(result.meta).toMatchObject({ total: 5, pageCount: 1 });
    });

    it('omite el filtro de activos cuando includeInactive es true', async () => {
      const qb = buildQb([[], 0]);
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({}, true);

      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('lanza NotFound si no existe', async () => {
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('retorna el profesional con su persona', async () => {
      repo.findOne.mockResolvedValue({ id: 'prof-1' });

      await expect(service.findOne('prof-1')).resolves.toEqual({ id: 'prof-1' });
    });
  });

  describe('update', () => {
    it('rechaza un documento ya usado por otra persona', async () => {
      repo.findOne.mockResolvedValue({ id: 'prof-1', personId: 'person-1' });
      personRepo.findOne.mockResolvedValue({ id: 'person-2' });

      await expect(
        service.update('prof-1', { documentId: '999' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('actualiza persona y profesional, marcando desactivación', async () => {
      repo.findOne
        .mockResolvedValueOnce({
          id: 'prof-1',
          personId: 'person-1',
          deactivatedAt: null,
        })
        .mockResolvedValueOnce({ id: 'prof-1' });

      await service.update('prof-1', {
        firstName: 'Ana',
        specialty: 'Deportología',
        isActive: false,
      } as any);

      expect(personRepo.update).toHaveBeenCalledWith(
        'person-1',
        expect.objectContaining({ firstName: 'Ana' }),
      );
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'prof-1' },
        expect.objectContaining({
          specialty: 'Deportología',
          deactivatedAt: expect.any(Date),
        }),
      );
    });

    it('reactiva y limpia deactivatedAt', async () => {
      repo.findOne
        .mockResolvedValueOnce({
          id: 'prof-1',
          personId: 'person-1',
          deactivatedAt: new Date(),
        })
        .mockResolvedValueOnce({ id: 'prof-1' });

      await service.update('prof-1', { isActive: true } as any);

      expect(repo.update).toHaveBeenCalledWith(
        { id: 'prof-1' },
        expect.objectContaining({ deactivatedAt: null }),
      );
    });
  });

  describe('deactivate / reactivate', () => {
    it('deactivate delega en update con isActive=false', async () => {
      const spy = jest
        .spyOn(service, 'update')
        .mockResolvedValue({ id: 'prof-1' } as any);

      await service.deactivate('prof-1');

      expect(spy).toHaveBeenCalledWith('prof-1', { isActive: false });
    });

    it('reactivate delega en update con isActive=true', async () => {
      const spy = jest
        .spyOn(service, 'update')
        .mockResolvedValue({ id: 'prof-1' } as any);

      await service.reactivate('prof-1');

      expect(spy).toHaveBeenCalledWith('prof-1', { isActive: true });
    });
  });
});
