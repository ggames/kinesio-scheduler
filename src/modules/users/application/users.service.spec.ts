import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { UserStatus } from '../domain/user.entity';

function buildQb() {
  const qb: any = {};
  for (const method of [
    'leftJoinAndSelect',
    'select',
    'orderBy',
    'skip',
    'take',
    'andWhere',
    'where',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getManyAndCount = (jest.fn() as any).mockResolvedValue([[], 0]);
  qb.getOne = (jest.fn() as any).mockResolvedValue(null);
  return qb;
}

function buildDataSource() {
  const execution = { affected: 2 };
  const qb: any = {};
  qb.update = jest.fn(() => qb);
  qb.set = jest.fn(() => qb);
  qb.where = jest.fn(() => qb);
  qb.execute = (jest.fn() as any).mockResolvedValue(execution);
  return {
    createQueryBuilder: (jest.fn() as any).mockReturnValue(qb),
    qb,
    execution,
  };
}

function baseUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-1',
    email: 'user@test.com',
    role: 'STAFF',
    roles: ['STAFF'],
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
    ...overrides,
  };
}

describe('UsersService', () => {
  let repo: any;
  let dataSource: ReturnType<typeof buildDataSource>;
  let audit: any;
  let service: UsersService;

  beforeEach(() => {
    repo = {
      findOne: (jest.fn() as any).mockResolvedValue(null),
      create: (jest.fn() as any).mockImplementation((value: any) => ({ ...value })),
      save: (jest.fn() as any).mockImplementation(async (value: any) => ({
        id: 'user-new',
        ...value,
      })),
      createQueryBuilder: (jest.fn() as any).mockImplementation(() => buildQb()),
    };
    dataSource = buildDataSource();
    audit = { record: (jest.fn() as any).mockResolvedValue(undefined) };
    service = new UsersService(repo, dataSource as any, audit);
  });

  describe('lookups', () => {
    it('findByEmail retorna null si el email está vacío', async () => {
      await expect(service.findByEmail('')).resolves.toBeNull();
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('findByEmail normaliza el email', async () => {
      repo.findOne.mockResolvedValue(baseUser());

      await service.findByEmail('  USER@TEST.COM ');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { email: 'user@test.com' },
      });
    });

    it('findById retorna null si el id está vacío', async () => {
      await expect(service.findById('')).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('hashea la contraseña y guarda el usuario', async () => {
      const result: any = await service.create('  New@Test.com ', 'Password123', 'PATIENT');

      expect(result.email).toBe('new@test.com');
      expect(result.roles).toEqual(['PATIENT']);
      expect(await bcrypt.compare('Password123', result.passwordHash)).toBe(true);
    });
  });

  describe('createAdmin', () => {
    it('rechaza emails duplicados', async () => {
      repo.findOne.mockResolvedValue(baseUser());

      await expect(
        service.createAdmin({
          email: 'user@test.com',
          password: 'Password123',
          role: 'STAFF',
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('crea el usuario activo y audita', async () => {
      const qb = buildQb();
      qb.getOne.mockResolvedValue({ id: 'user-new', email: 'new@test.com' });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.createAdmin(
        {
          email: 'New@Test.com',
          password: 'Password123',
          roles: ['STAFF', 'ADMIN'],
        } as any,
        'actor-1',
      );

      expect(result).toMatchObject({ id: 'user-new' });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@test.com',
          status: UserStatus.ACTIVE,
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ targetUserId: 'user-new' }),
      );
    });
  });

  describe('findAll', () => {
    it('aplica filtros de estado, rol y búsqueda', async () => {
      const qb = buildQb();
      qb.getManyAndCount.mockResolvedValue([[{ id: 'u1' }], 21]);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({
        page: 2,
        limit: 10,
        status: UserStatus.ACTIVE,
        role: 'STAFF',
        search: 'ana',
      } as any);

      expect(qb.andWhere).toHaveBeenCalledTimes(3);
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(result.meta).toMatchObject({
        page: 2,
        limit: 10,
        total: 21,
        pageCount: 3,
        hasNext: true,
        hasPrevious: true,
      });
    });
  });

  describe('findAdminOne', () => {
    it('lanza NotFound si el usuario no existe', async () => {
      await expect(service.findAdminOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateAdmin', () => {
    it('lanza NotFound si el usuario no existe', async () => {
      await expect(
        service.updateAdmin('missing', {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza cambiar a un email ya registrado', async () => {
      repo.findOne
        .mockResolvedValueOnce(baseUser())
        .mockResolvedValueOnce({ id: 'other' });

      await expect(
        service.updateAdmin('user-1', { email: 'taken@test.com' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('incrementa tokenVersion y revoca sesiones al desactivar', async () => {
      const user = baseUser();
      repo.findOne.mockResolvedValue(user);
      const qb = buildQb();
      qb.getOne.mockResolvedValue({ id: 'user-1' });
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.updateAdmin('user-1', {
        status: UserStatus.INACTIVE,
      } as any);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 1 }),
      );
      expect(dataSource.qb.execute).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalled();
    });

    it('no persiste cambios cuando no hay campos distintos', async () => {
      const user = baseUser({ role: 'STAFF', roles: ['STAFF'] });
      repo.findOne.mockResolvedValue(user);
      const qb = buildQb();
      qb.getOne.mockResolvedValue({ id: 'user-1' });
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.updateAdmin('user-1', {} as any);

      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('revokeSessions', () => {
    it('lanza NotFound si el usuario no existe', async () => {
      await expect(service.revokeSessions('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('incrementa tokenVersion y retorna sesiones revocadas', async () => {
      repo.findOne.mockResolvedValue(baseUser({ tokenVersion: 3 }));

      const result = await service.revokeSessions('user-1', 'actor-1');

      expect(result).toEqual({ revoked: 2 });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 4 }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { revoked: 2 } }),
      );
    });
  });
});
