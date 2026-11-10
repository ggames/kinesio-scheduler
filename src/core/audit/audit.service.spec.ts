import { jest } from '@jest/globals';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const build = () => {
    const qb = {
      andWhere: (jest.fn() as any).mockReturnThis(),
      orderBy: (jest.fn() as any).mockReturnThis(),
      skip: (jest.fn() as any).mockReturnThis(),
      take: (jest.fn() as any).mockReturnThis(),
      getManyAndCount: (jest.fn() as any).mockResolvedValue([[], 0]),
      getMany: (jest.fn() as any).mockResolvedValue([]),
    };
    const auditRepository = {
      createQueryBuilder: (jest.fn() as any).mockReturnValue(qb),
      create: (jest.fn() as any).mockImplementation((data: any) => data),
      save: (jest.fn() as any).mockResolvedValue(undefined),
    };
    const userRepository = {
      findOne: (jest.fn() as any).mockResolvedValue({
        id: 'user-1',
        clinicId: 'clinic-a',
      }),
    };
    const requestContext = { get: () => undefined };
    const service = new AuditService(
      auditRepository as any,
      userRepository as any,
      requestContext as any,
    );
    return { service, auditRepository, userRepository, qb };
  };

  it('asigna la clínica del actor al registrar el evento', async () => {
    const { service, auditRepository } = build();

    await service.record({ eventType: 'TEST', actorUserId: 'user-1' });

    expect(auditRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'TEST', clinicId: 'clinic-a' }),
    );
  });

  it('respeta una clínica explícita sin consultar al usuario', async () => {
    const { service, auditRepository, userRepository } = build();

    await service.record({
      eventType: 'TEST',
      actorUserId: 'user-1',
      clinicId: 'clinic-b',
    });

    expect(userRepository.findOne).not.toHaveBeenCalled();
    expect(auditRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: 'clinic-b' }),
    );
  });

  it('filtra el listado por clínica cuando hay scope', async () => {
    const { service, qb } = build();

    await service.findAll({ page: 1, limit: 10 }, 'clinic-a');

    expect(qb.andWhere).toHaveBeenCalledWith('audit.clinicId = :clinicId', {
      clinicId: 'clinic-a',
    });
  });

  it('no filtra por clínica para ADMIN global (scope null)', async () => {
    const { service, qb } = build();

    await service.findAll({ page: 1, limit: 10 }, null);

    expect(qb.andWhere).not.toHaveBeenCalledWith(
      'audit.clinicId = :clinicId',
      expect.anything(),
    );
  });
});
