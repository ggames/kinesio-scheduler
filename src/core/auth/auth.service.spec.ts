import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { UsersService } from '../../modules/users/application/users.service';
import { TokenBlacklist } from '../../modules/users/domain/token-blacklist.entity';
import { User, UserStatus } from '../../modules/users/domain/user.entity';
import { MailService } from '../mail/mail.service';
import { LoginAttemptService } from './login-attempt.service';
import { RefreshTokenService } from './refresh-token.service';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const mockUser = {
  id: 'user-1',
  email: 'kine@test.com',
  passwordHash: bcrypt.hashSync('password123', 10),
  role: 'PROFESSIONAL',
  roles: ['PROFESSIONAL'],
  status: UserStatus.ACTIVE,
  tokenVersion: 0,
};

const baseConfig: Record<string, string> = {
  APP_URL: 'http://localhost:3000',
  JWT_SECRET: 'test-secret-0123456789abcdef0123456789',
  FRONTEND_URL: 'http://localhost:4200',
  NODE_ENV: 'test',
};

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildManagerMock(options: {
  existingUser?: any;
  existingPerson?: any;
  existingProfessional?: any;
  existingPatient?: any;
} = {}) {
  return {
    findOne: (jest.fn() as any).mockImplementation(async (_entity: any, query: any) => {
      if (query?.where?.email) return options.existingUser ?? null;
      if (query?.where?.documentId) return options.existingPerson ?? null;
      if (query?.where?.licenseNumber) return options.existingProfessional ?? null;
      if (query?.where?.personId) return options.existingPatient ?? null;
      if (query?.where?.activationTokenHash) return options.existingUser ?? null;
      return null;
    }),
    create: (jest.fn() as any).mockImplementation((_target: any, dto: any) => ({
      id: 'gen-id',
      ...dto,
    })),
    save: (jest.fn() as any).mockImplementation(async (_target: any, entity: any) => entity),
  };
}

function buildDataSourceMock(manager: any, repository: any) {
  return {
    transaction: (jest.fn() as any).mockImplementation(async (cb: any) => cb(manager)),
    getRepository: (jest.fn() as any).mockReturnValue(repository),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let mailService: any;
  let loginAttemptService: any;
  let refreshTokenService: any;
  let auditService: any;

  const createService = async (options: {
    manager?: any;
    repository?: any;
    config?: Record<string, string>;
    user?: any;
  } = {}) => {
    const manager = options.manager ?? buildManagerMock();
    const repository = options.repository ?? {
      findOne: (jest.fn() as any).mockResolvedValue(mockUser),
      save: (jest.fn() as any).mockImplementation(async (entity: any) => entity),
    };
    const config = { ...baseConfig, ...options.config };
    const foundUser = options.user === undefined ? mockUser : options.user;
    mailService = {
      enqueueActivationEmail: (jest.fn() as any).mockResolvedValue({ id: 'outbox-1' }),
      enqueuePasswordResetEmail: (jest.fn() as any).mockResolvedValue({ id: 'outbox-2' }),
      enqueueWelcomeEmail: (jest.fn() as any).mockResolvedValue({ id: 'outbox-3' }),
    };
    loginAttemptService = {
      assertNotLocked: (jest.fn() as any).mockResolvedValue(undefined),
      recordFailure: (jest.fn() as any).mockResolvedValue(undefined),
      clearFailures: (jest.fn() as any).mockResolvedValue(undefined),
    };
    refreshTokenService = {
      issue: (jest.fn() as any).mockResolvedValue({ token: 'mock.refresh.token' }),
      rotate: (jest.fn() as any).mockResolvedValue({
        token: 'rotated.refresh.token',
        user: foundUser,
      }),
      revoke: (jest.fn() as any).mockResolvedValue(undefined),
      revokeAllForUser: (jest.fn() as any).mockResolvedValue(undefined),
    };
    auditService = {
      record: (jest.fn() as any).mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: { findByEmail: (jest.fn() as any).mockResolvedValue(foundUser) },
        },
        {
          provide: JwtService,
          useValue: {
            sign: (jest.fn() as any).mockReturnValue('mock.jwt.token'),
            decode: (jest.fn() as any).mockReturnValue({
              exp: Math.floor(Date.now() / 1000) + 3600,
            }),
          },
        },
        {
          provide: MailService,
          useValue: mailService,
        },
        {
          provide: LoginAttemptService,
          useValue: loginAttemptService,
        },
        {
          provide: RefreshTokenService,
          useValue: refreshTokenService,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (jest.fn() as any).mockImplementation((key: string) => config[key]),
          },
        },
        {
          provide: getRepositoryToken(TokenBlacklist),
          useValue: {
            save: (jest.fn() as any),
            findOne: (jest.fn() as any).mockResolvedValue(null),
            delete: (jest.fn() as any),
          },
        },
        {
          provide: getDataSourceToken(),
          useValue: buildDataSourceMock(manager, repository),
        },
      ],
    }).compile();

    return {
      module,
      service: module.get(AuthService),
      jwtService: module.get(JwtService),
      repository,
      manager,
    };
  };

  beforeEach(async () => {
    const created = await createService();
    service = created.service;
    jwtService = created.jwtService;
  });

  describe('login', () => {
    it('debe retornar un access_token con credenciales válidas', async () => {
      const result = await service.login({ email: 'kine@test.com', password: 'password123' });
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.access_token).toBe('mock.jwt.token');
      expect(result.refresh_token).toBe('mock.refresh.token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ ver: 0 }),
      );
    });

    it('debe normalizar el email antes de buscar el usuario', async () => {
      const result = await service.login({
        email: '  KINE@TEST.COM ',
        password: 'password123',
      });
      expect(result.user.email).toBe('kine@test.com');
    });

    it('debe lanzar UnauthorizedException con contraseña incorrecta y registrar el fallo', async () => {
      await expect(service.login({ email: 'kine@test.com', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);

      expect(loginAttemptService.recordFailure).toHaveBeenCalledWith('kine@test.com');
      expect(loginAttemptService.clearFailures).not.toHaveBeenCalled();
    });

    it('debe limpiar los fallos luego de un login exitoso', async () => {
      await service.login({ email: 'kine@test.com', password: 'password123' });

      expect(loginAttemptService.assertNotLocked).toHaveBeenCalledWith('kine@test.com');
      expect(loginAttemptService.clearFailures).toHaveBeenCalledWith('kine@test.com');
    });

    it('debe rechazar una cuenta PENDING sin revelar su estado', async () => {
      const pendingUser = {
        ...mockUser,
        status: UserStatus.PENDING,
        passwordHash: '',
      };
      const created = await createService({ user: pendingUser });

      await expect(
        created.service.login({ email: 'kine@test.com', password: 'password123' }),
      ).rejects.toThrow('Credenciales inválidas');
    });
  });

  describe('registerPatient', () => {
    it('debe crear un usuario y perfil de paciente dentro de una transacción', async () => {
      const result = await service.registerPatient({
        email: '  Nuevo@Paciente.com ',
        password: 'Password123',
        firstName: ' Juan ',
        lastName: ' Pérez ',
        documentId: ' 99887766 ',
      });

      expect(result).toHaveProperty('access_token');
      expect(result.user.email).toBe('nuevo@paciente.com');
      expect(result.user.role).toBe('PATIENT');
      expect(result.person).toBeDefined();
      expect(result.person.firstName).toBe('Juan');
      expect(result.person.documentId).toBe('99887766');
      expect(mailService.enqueueWelcomeEmail).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ to: 'nuevo@paciente.com', firstName: 'Juan' }),
      );
    });

    it('debe ignorar un rol privilegiado enviado por el cliente', async () => {
      const result = await service.registerPatient({
        email: 'escalada@paciente.com',
        password: 'Password123',
        firstName: 'Juan',
        lastName: 'Pérez',
        documentId: '11223344',
        role: 'ADMIN',
      } as any);

      expect(result.user.role).toBe('PATIENT');
      expect(result.user.roles).toEqual(['PATIENT']);
    });

    it('debe lanzar ConflictException si el email ya existe', async () => {
      const created = await createService({
        manager: buildManagerMock({
          existingUser: { id: 'u1', email: 'existe@test.com' },
        }),
      });

      await expect(
        created.service.registerPatient({
          email: 'existe@test.com',
          password: 'Password123',
          firstName: 'Juan',
          lastName: 'Pérez',
          documentId: '12345678',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe rechazar un documento ya vinculado a otro usuario', async () => {
      const created = await createService({
        manager: buildManagerMock({
          existingPerson: { id: 'person-1', userId: 'another-user' },
        }),
      });

      await expect(
        created.service.registerPatient({
          email: 'nuevo@test.com',
          password: 'Password123',
          firstName: 'Juan',
          lastName: 'Pérez',
          documentId: '12345678',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('registerProfessional', () => {
    it('debe registrar un profesional PENDING, hashear el token y exponer el link solo en dev', async () => {
      let savedUser: any;
      const manager = buildManagerMock();
      manager.save = (jest.fn() as any).mockImplementation(async (target: any, entity: any) => {
        if (target === User) savedUser = entity;
        return entity;
      });

      const created = await createService({ manager });
      const result: any = await created.service.registerProfessional({
        email: '  Profesional@Test.com ',
        firstName: 'Carlos',
        lastName: 'Gómez',
        documentId: '28765432',
        licenseNumber: 'MP-9988',
        specialty: 'Traumatología',
        roles: ['STAFF', 'PATIENT'],
      });

      expect(result).toHaveProperty('activationToken');
      expect(result).toHaveProperty('activationLink');
      expect(result.activationToken).toHaveLength(64);
      expect(result).not.toHaveProperty('activationTokenHash');
      expect(result.user.status).toBe(UserStatus.PENDING);
      expect(result.user.email).toBe('profesional@test.com');
      expect(result.professional.licenseNumber).toBe('MP-9988');
      expect(result.user.roles).toEqual(expect.arrayContaining(['STAFF', 'PATIENT']));

      expect(savedUser.activationTokenHash).toBe(sha256(result.activationToken));
      expect(savedUser.activationTokenHash).not.toBe(result.activationToken);
      expect(mailService.enqueueActivationEmail).toHaveBeenCalledWith(
        created.manager,
        expect.objectContaining({
          to: 'profesional@test.com',
          firstName: 'Carlos',
          token: result.activationToken,
        }),
      );
    });

    it('no debe exponer token ni link en producción', async () => {
      const created = await createService({ config: { NODE_ENV: 'production' } });
      const result: any = await created.service.registerProfessional({
        email: 'profesional@test.com',
        firstName: 'Carlos',
        lastName: 'Gómez',
        documentId: '28765432',
        licenseNumber: 'MP-9988',
        specialty: 'Traumatología',
        roles: ['STAFF'],
      });

      expect(result).not.toHaveProperty('activationToken');
      expect(result).not.toHaveProperty('activationLink');
      expect(result.message).toBeDefined();
      expect(mailService.enqueueActivationEmail).toHaveBeenCalled();
    });
  });

  describe('activateAccount', () => {
    it('debe activar la cuenta PENDING y retornar un access_token', async () => {
      const rawToken = 'token-valido';
      const pendingUser = {
        id: 'u-pending',
        email: 'prof@test.com',
        role: 'PROFESSIONAL',
        roles: ['PROFESSIONAL'],
        status: UserStatus.PENDING,
        activationTokenHash: sha256(rawToken),
        activationTokenExpiresAt: new Date(Date.now() + 3600000),
        tokenVersion: 0,
      };

      const created = await createService({
        manager: buildManagerMock({ existingUser: pendingUser }),
      });

      const result = await created.service.activateAccount({
        token: rawToken,
        password: 'NuevaPassword123',
      });

      expect(result).toHaveProperty('access_token');
      expect(result.user.status).toBe(UserStatus.ACTIVE);
    });

    it('debe lanzar BadRequestException si el token expiró', async () => {
      const expiredUser = {
        id: 'u-expired',
        email: 'prof@test.com',
        role: 'PROFESSIONAL',
        status: UserStatus.PENDING,
        activationTokenHash: sha256('token-expiro'),
        activationTokenExpiresAt: new Date(Date.now() - 3600000),
        tokenVersion: 0,
      };

      const created = await createService({
        manager: buildManagerMock({ existingUser: expiredUser }),
      });

      await expect(
        created.service.activateAccount({
          token: 'token-expiro',
          password: 'NuevaPassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refresh', () => {
    it('debe rotar el refresh token y retornar un nuevo access_token', async () => {
      const result = await service.refresh({ refresh_token: 'old.refresh.token' });

      expect(refreshTokenService.rotate).toHaveBeenCalledWith('old.refresh.token');
      expect(result).toHaveProperty('access_token');
      expect(result.refresh_token).toBe('rotated.refresh.token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', ver: 0 }),
      );
    });
  });

  describe('logoutAll', () => {
    it('debe revocar todas las sesiones e incrementar tokenVersion', async () => {
      const user = { ...mockUser, tokenVersion: 1 };
      const created = await createService({
        repository: {
          findOne: (jest.fn() as any).mockResolvedValue(user),
          save: (jest.fn() as any).mockImplementation(async (entity: any) => entity),
        },
      });

      const result = await created.service.logoutAll('user-1');

      expect(result.message).toBeDefined();
      expect(created.repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 2 }),
      );
      expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('changePassword', () => {
    it('debe incrementar tokenVersion para invalidar sesiones previas', async () => {
      const user = {
        ...mockUser,
        passwordHash: bcrypt.hashSync('CurrentPassword123', 10),
        tokenVersion: 2,
      };
      const created = await createService({
        repository: {
          findOne: (jest.fn() as any).mockResolvedValue(user),
          save: (jest.fn() as any).mockImplementation(async (entity: any) => entity),
        },
      });

      await created.service.changePassword('user-1', {
        currentPassword: 'CurrentPassword123',
        newPassword: 'NewPassword123',
      });

      expect(created.repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 3 }),
      );
      expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('debe rechazar la misma contraseña actual', async () => {
      const user = {
        ...mockUser,
        passwordHash: bcrypt.hashSync('Password123', 10),
      };
      const created = await createService({
        repository: {
          findOne: (jest.fn() as any).mockResolvedValue(user),
          save: (jest.fn() as any),
        },
      });

      await expect(
        created.service.changePassword('user-1', {
          currentPassword: 'Password123',
          newPassword: 'Password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar contraseñas de más de 72 bytes', async () => {
      const user = {
        ...mockUser,
        passwordHash: bcrypt.hashSync('CurrentPassword123', 10),
      };
      const created = await createService({
        repository: {
          findOne: (jest.fn() as any).mockResolvedValue(user),
          save: (jest.fn() as any),
        },
      });

      await expect(
        created.service.changePassword('user-1', {
          currentPassword: 'CurrentPassword123',
          newPassword: 'A1' + 'a'.repeat(71),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('isTokenBlacklisted', () => {
    it('debe retornar false cuando el token no está en el blacklist', async () => {
      const result = await service.isTokenBlacklisted('any-token');
      expect(result).toBe(false);
    });
  });

  describe('requestPasswordReset', () => {
    it('debe encolar el email y auditar cuando el usuario está activo', async () => {
      await service.requestPasswordReset('KINE@TEST.COM');

      expect(mailService.enqueuePasswordResetEmail).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ to: 'kine@test.com' }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'PASSWORD_RESET_REQUEST' }),
      );
    });

    it('debe retornar en silencio cuando el usuario no existe', async () => {
      const created = await createService({ user: null });

      await expect(
        created.service.requestPasswordReset('nadie@test.com'),
      ).resolves.toBeUndefined();
      expect(mailService.enqueuePasswordResetEmail).not.toHaveBeenCalled();
    });

    it('debe retornar en silencio cuando el usuario no está activo', async () => {
      const created = await createService({
        user: { ...mockUser, status: UserStatus.PENDING },
      });

      await expect(
        created.service.requestPasswordReset('kine@test.com'),
      ).resolves.toBeUndefined();
      expect(mailService.enqueuePasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const future = () => new Date(Date.now() + 3600000);

    const buildResetRepository = (tokenEntity: any) => ({
      findOne: (jest.fn() as any).mockResolvedValue(tokenEntity),
      save: (jest.fn() as any).mockImplementation(async (entity: any) => entity),
    });

    const buildResetManager = () => ({
      findOne: (jest.fn() as any).mockImplementation(async (_entity: any, query: any) =>
        query?.where?.id ? { ...mockUser, tokenVersion: 4 } : null,
      ),
      save: (jest.fn() as any).mockImplementation(async (_entity: any, value: any) => value),
    });

    it('debe actualizar la contraseña, incrementar tokenVersion y revocar sesiones', async () => {
      const tokenEntity = {
        userId: 'user-1',
        tokenHash: sha256('valid-token'),
        used: false,
        expiresAt: future(),
      };
      const manager = buildResetManager();
      const created = await createService({
        repository: buildResetRepository(tokenEntity),
        manager,
      });

      await created.service.resetPassword('valid-token', 'NewPassword123');

      expect(manager.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ tokenVersion: 5 }),
      );
      expect(manager.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ used: true }),
      );
      expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith('user-1');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'PASSWORD_RESET' }),
      );
    });

    it('debe rechazar un token ya utilizado', async () => {
      const created = await createService({
        repository: buildResetRepository({
          userId: 'user-1',
          used: true,
          expiresAt: future(),
        }),
      });

      await expect(
        created.service.resetPassword('used-token', 'NewPassword123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar un token expirado', async () => {
      const created = await createService({
        repository: buildResetRepository({
          userId: 'user-1',
          used: false,
          expiresAt: new Date(Date.now() - 1000),
        }),
      });

      await expect(
        created.service.resetPassword('expired-token', 'NewPassword123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar un token inexistente', async () => {
      const created = await createService({
        repository: buildResetRepository(null),
      });

      await expect(
        created.service.resetPassword('missing-token', 'NewPassword123'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
