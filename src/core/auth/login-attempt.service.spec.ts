import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { LoginAttempt } from './domain/login-attempt.entity';
import { LoginAttemptService } from './login-attempt.service';

describe('LoginAttemptService', () => {
  const buildService = (options: {
    attempt?: Partial<LoginAttempt> | null;
  } = {}) => {
    const repository = {
      findOne: (jest.fn() as any).mockResolvedValue(options.attempt ?? null),
      delete: (jest.fn() as any).mockResolvedValue({ affected: 1 }),
    };
    const dataSource = {
      query: (jest.fn() as any).mockResolvedValue(undefined),
    };
    const configService = {
      get: (jest.fn() as any).mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') return 'test-secret-0123456789abcdef0123456789';
        return undefined;
      }),
    };

    return {
      service: new LoginAttemptService(
        repository as unknown as Repository<LoginAttempt>,
        dataSource as unknown as DataSource,
        configService as unknown as ConfigService,
      ),
      repository,
      dataSource,
    };
  };

  it('debe rechazar un login cuando la cuenta está bloqueada', async () => {
    const { service } = buildService({
      attempt: {
        lockedUntil: new Date(Date.now() + 60_000),
      },
    });

    await expect(service.assertNotLocked('kine@test.com')).rejects.toThrow(
      'Credenciales inválidas',
    );
  });

  it('debe permitir un login cuando el bloqueo expiró', async () => {
    const { service } = buildService({
      attempt: {
        lockedUntil: new Date(Date.now() - 60_000),
      },
    });

    await expect(service.assertNotLocked('kine@test.com')).resolves.toBeUndefined();
  });

  it('debe registrar el fallo usando un hash del email', async () => {
    const { service, dataSource } = buildService();

    await service.recordFailure('  Kine@Test.com ');

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "login_attempts"'),
      expect.arrayContaining([
        expect.stringMatching(/^[a-f0-9]{64}$/),
        15,
        10,
        15,
      ]),
    );
    expect(dataSource.query.mock.calls[0][1][0]).not.toContain('kine@test.com');
  });

  it('debe limpiar los fallos de un email', async () => {
    const { service, repository } = buildService();

    await service.clearFailures('kine@test.com');

    expect(repository.delete).toHaveBeenCalledWith({
      emailHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });
});
