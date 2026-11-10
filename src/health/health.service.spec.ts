import { jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

function buildDataSource(options: {
  failDb?: boolean;
  executed?: string[];
  loaded?: { name?: string }[];
}) {
  return {
    query: async (sql: string) => {
      if (sql === 'SELECT 1') {
        if (options.failDb) throw new Error('db down');
        return [{ '?column?': 1 }];
      }
      return (options.executed ?? []).map((name) => ({ name }));
    },
    migrations: options.loaded ?? [],
  } as any;
}

function buildOutboxRepository() {
  return {
    count: (jest.fn() as any).mockResolvedValue(0),
  } as any;
}

describe('HealthService', () => {
  const mailService = {} as any;
  const smsProvider = { isEnabled: (jest.fn() as any).mockReturnValue(true) } as any;
  const storageProvider = { baseDir: '/tmp/uploads' } as any;
  const outboxRepository = buildOutboxRepository();

  it('reporta base de datos arriba', async () => {
    const service = new HealthService(
      buildDataSource({}),
      mailService,
      smsProvider,
      storageProvider,
      outboxRepository,
    );
    await expect(service.checkDatabase()).resolves.toMatchObject({
      database: 'up',
    });
  });

  it('falla readiness si hay migraciones pendientes', async () => {
    const service = new HealthService(
      buildDataSource({
        executed: ['MigrationA'],
        loaded: [{ name: 'MigrationA' }, { name: 'MigrationB' }],
      }),
      mailService,
      smsProvider,
      storageProvider,
      outboxRepository,
    );

    await expect(service.checkReadiness()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('marca readiness ok cuando todas las migraciones están aplicadas', async () => {
    const service = new HealthService(
      buildDataSource({
        executed: ['MigrationA', 'MigrationB'],
        loaded: [{ name: 'MigrationA' }, { name: 'MigrationB' }],
      }),
      mailService,
      smsProvider,
      storageProvider,
      outboxRepository,
    );

    await expect(service.checkReadiness()).resolves.toMatchObject({
      status: 'ok',
      migrations: 'up',
    });
  });
});
