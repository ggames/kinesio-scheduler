import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenService } from './refresh-token.service';
import { UserStatus } from '../../modules/users/domain/user.entity';
import { RequestContextService } from '../request-context/request-context.service';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../audit/domain/audit-log.entity';
import { sha256 } from '../utils/hash.util';

const mockUser = {
  id: 'user-1',
  email: 'kine@test.com',
  status: UserStatus.ACTIVE,
  tokenVersion: 0,
};

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let repository: any;
  let manager: any;
  let dataSource: any;
  let auditService: any;

  const buildService = async (options: {
    currentToken?: any;
    user?: any;
  } = {}) => {
    repository = {
      save: (jest.fn() as any).mockImplementation(async (entity: any) => ({
        ...entity,
        id: entity.id ?? 'generated-id',
      })),
      findOne: (jest.fn() as any).mockResolvedValue(options.currentToken ?? null),
      update: (jest.fn() as any).mockResolvedValue({ affected: 1 }),
      delete: (jest.fn() as any).mockResolvedValue({ affected: 0 }),
    };
    manager = {
      getRepository: (jest.fn() as any).mockReturnValue(repository),
      findOne: (jest.fn() as any).mockResolvedValue(
        options.user === undefined ? mockUser : options.user,
      ),
    };
    dataSource = {
      getRepository: (jest.fn() as any).mockReturnValue(repository),
      transaction: (jest.fn() as any).mockImplementation(async (cb: any) =>
        cb(manager),
      ),
    };
    auditService = {
      record: (jest.fn() as any).mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        { provide: getDataSourceToken(), useValue: dataSource },
        {
          provide: ConfigService,
          useValue: {
            get: (jest.fn() as any).mockImplementation((key: string) =>
              key === 'REFRESH_TOKEN_TTL_DAYS' ? '30' : undefined,
            ),
          },
        },
        {
          provide: RequestContextService,
          useValue: { get: (jest.fn() as any).mockReturnValue(undefined) },
        },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    return module.get(RefreshTokenService);
  };

  it('debe emitir un token opaco y guardar solo su hash', async () => {
    service = await buildService();

    const issued = await service.issue('user-1');

    expect(issued.token).toHaveLength(96);
    expect(issued.entity.tokenHash).toBe(sha256(issued.token));
    expect(issued.entity.tokenHash).not.toBe(issued.token);
    expect(issued.entity.familyId).toBeDefined();
    expect(issued.entity.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: sha256(issued.token) }),
    );
  });

  it('debe rotar un token válido y revocar el anterior', async () => {
    const current = {
      id: 'token-current',
      userId: 'user-1',
      tokenHash: sha256('old-token'),
      familyId: 'family-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedByTokenId: null,
    };
    service = await buildService({ currentToken: current });

    const rotated = await service.rotate('old-token');

    expect(rotated.token).not.toBe('old-token');
    expect(rotated.user).toEqual(mockUser);
    expect(current.revokedAt).toBeInstanceOf(Date);
    expect(current.replacedByTokenId).toBeDefined();
  });

  it('debe revocar la familia completa al detectar reutilización', async () => {
    const revoked = {
      id: 'token-revoked',
      userId: 'user-1',
      tokenHash: sha256('reused-token'),
      familyId: 'family-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
    };
    service = await buildService({ currentToken: revoked });

    await expect(service.rotate('reused-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(repository.update).toHaveBeenCalledWith(
      { familyId: 'family-1' },
      { revokedAt: expect.any(Date) },
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.REFRESH_TOKEN_REUSE,
        targetUserId: 'user-1',
      }),
    );
  });

  it('debe rechazar un token expirado sin rotarlo', async () => {
    const expired = {
      id: 'token-expired',
      userId: 'user-1',
      tokenHash: sha256('expired-token'),
      familyId: 'family-1',
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
    };
    service = await buildService({ currentToken: expired });

    await expect(service.rotate('expired-token')).rejects.toThrow(
      'Refresh token expirado',
    );
  });

  it('debe revocar todos los tokens de un usuario', async () => {
    service = await buildService();

    await service.revokeAllForUser('user-1');

    expect(repository.update).toHaveBeenCalledWith(
      { userId: 'user-1', revokedAt: expect.anything() },
      { revokedAt: expect.any(Date) },
    );
  });
});
