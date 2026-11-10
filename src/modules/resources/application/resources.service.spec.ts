import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ResourcesService } from './resources.service';

function buildQb(result: [any[], number] = [[], 0]) {
  const qb: any = {};
  for (const method of ['orderBy', 'skip', 'take', 'andWhere']) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getManyAndCount = (jest.fn() as any).mockResolvedValue(result);
  return qb;
}

function buildRepo(qb = buildQb()) {
  return {
    create: (jest.fn() as any).mockImplementation((value: any) => ({ ...value })),
    save: (jest.fn() as any).mockImplementation(async (value: any) => value),
    findOne: (jest.fn() as any).mockResolvedValue(null),
    remove: (jest.fn() as any).mockResolvedValue(undefined),
    createQueryBuilder: (jest.fn() as any).mockReturnValue(qb),
  };
}

describe('ResourcesService', () => {
  let repo: ReturnType<typeof buildRepo>;
  let service: ResourcesService;

  beforeEach(() => {
    repo = buildRepo();
    service = new ResourcesService(repo as any);
  });

  it('crea un recurso', async () => {
    const result = await service.create({ name: 'Camilla', type: 'EQUIPMENT' } as any);

    expect(result).toMatchObject({ name: 'Camilla', type: 'EQUIPMENT' });
  });

  it('lista recursos con búsqueda y paginación', async () => {
    const qb = buildQb([[{ id: 'r1' }], 3]);
    repo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll({ search: 'cami', page: 2, limit: 2 } as any);

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      { search: '%cami%' },
    );
    expect(qb.skip).toHaveBeenCalledWith(2);
    expect(result.meta).toMatchObject({ page: 2, limit: 2, total: 3 });
  });

  it('lista recursos sin búsqueda', async () => {
    const qb = buildQb([[], 0]);
    repo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll({});

    expect(qb.andWhere).not.toHaveBeenCalled();
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(result.meta).toMatchObject({ page: 1, limit: 20, total: 0 });
  });

  it('lanza NotFound si el recurso no existe', async () => {
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('actualiza el recurso existente', async () => {
    repo.findOne.mockResolvedValue({ id: 'r1', name: 'Camilla' });

    const result: any = await service.update('r1', { name: 'Camilla 2' } as any);

    expect(result.name).toBe('Camilla 2');
    expect(repo.save).toHaveBeenCalled();
  });

  it('elimina el recurso existente', async () => {
    repo.findOne.mockResolvedValue({ id: 'r1' });

    await service.remove('r1');

    expect(repo.remove).toHaveBeenCalledWith({ id: 'r1' });
  });

  it('traduce errores de integridad al eliminar', async () => {
    repo.findOne.mockResolvedValue({ id: 'r1' });
    repo.remove.mockRejectedValue(
      new QueryFailedError('DELETE', [], new Error('fk')),
    );

    await expect(service.remove('r1')).rejects.toThrow(ConflictException);
  });
});
