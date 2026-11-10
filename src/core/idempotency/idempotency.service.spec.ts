import { jest } from '@jest/globals';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { sha256 } from '../utils/hash.util';
import { IdempotencyService } from './idempotency.service';

const neverCalled = jest.fn(async () => {
  throw new Error('la acción no debería ejecutarse');
});

function buildService(options: {
  inserted?: { raw: unknown[] }[];
  existing?: unknown[];
}) {
  const inserted = [...(options.inserted ?? [])];
  const existing = [...(options.existing ?? [])];
  const update = jest.fn(async () => undefined);
  const remove = jest.fn(async () => undefined);
  const findOne = jest.fn(async () => existing.shift() ?? null);

  const queryBuilder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn(async () => inserted.shift() ?? { raw: [] }),
  };

  const dataSource = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    getRepository: jest.fn(() => ({
      update,
      delete: remove,
      findOne,
    })),
  };

  return {
    service: new IdempotencyService(dataSource as any),
    update,
    remove,
    findOne,
  };
}

const base = {
  userId: 'user-1',
  scope: 'appointments.create',
  payload: { timeSlotId: 'slot-1' },
};

describe('IdempotencyService', () => {
  it('ejecuta la acción sin tocar la base si no hay key', async () => {
    const { service, findOne } = buildService({});
    const action = jest.fn(async () => ({ id: 'appointment-1' }));

    await expect(service.execute({ ...base, action })).resolves.toEqual({
      id: 'appointment-1',
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('rechaza keys demasiado largas', async () => {
    const { service } = buildService({});

    await expect(
      service.execute({ ...base, key: 'x'.repeat(129), action: neverCalled }),
    ).rejects.toThrow(BadRequestException);
  });

  it('guarda la respuesta original al ejecutar por primera vez', async () => {
    const { service, update } = buildService({
      inserted: [{ raw: [{ id: 'idem-1' }] }],
    });

    const result = { id: 'appointment-1' };
    await expect(
      service.execute({ ...base, key: 'key-1', action: async () => result }),
    ).resolves.toEqual(result);

    expect(update).toHaveBeenCalledWith('idem-1', {
      statusCode: 201,
      response: result,
    });
  });

  it('devuelve la respuesta guardada para un reintento idéntico', async () => {
    const payload = { timeSlotId: 'slot-1' };
    const stored = { id: 'appointment-1' };
    const { service, update } = buildService({
      inserted: [{ raw: [] }],
      existing: [
        {
          id: 'idem-1',
          requestHash: sha256(JSON.stringify(payload)),
          statusCode: 201,
          response: stored,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    });

    await expect(
      service.execute({
        ...base,
        payload,
        key: 'key-1',
        action: neverCalled,
      }),
    ).resolves.toBe(stored);
    expect(update).not.toHaveBeenCalled();
  });

  it('rechaza un payload distinto con la misma key', async () => {
    const { service } = buildService({
      inserted: [{ raw: [] }],
      existing: [
        {
          id: 'idem-1',
          requestHash: 'otro-hash',
          statusCode: 201,
          response: {},
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    });

    await expect(
      service.execute({ ...base, key: 'key-1', action: neverCalled }),
    ).rejects.toThrow(ConflictException);
  });

  it('rechaza reintentos mientras la primera solicitud sigue en curso', async () => {
    const { service } = buildService({
      inserted: [{ raw: [] }],
      existing: [
        {
          id: 'idem-1',
          requestHash: sha256(JSON.stringify(base.payload)),
          statusCode: 0,
          response: null,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    });

    await expect(
      service.execute({ ...base, key: 'key-1', action: neverCalled }),
    ).rejects.toThrow(ConflictException);
  });

  it('borra el placeholder si la acción falla', async () => {
    const { service, update, remove } = buildService({
      inserted: [{ raw: [{ id: 'idem-1' }] }],
    });

    await expect(
      service.execute({
        ...base,
        key: 'key-1',
        action: async () => {
          throw new Error('fallo');
        },
      }),
    ).rejects.toThrow('fallo');

    expect(remove).toHaveBeenCalledWith({ id: 'idem-1' });
    expect(update).not.toHaveBeenCalled();
  });

  it('reintenta después de descartar una key vencida', async () => {
    const { service, update, remove } = buildService({
      inserted: [{ raw: [] }, { raw: [{ id: 'idem-2' }] }],
      existing: [
        {
          id: 'idem-1',
          requestHash: sha256(JSON.stringify(base.payload)),
          statusCode: 201,
          response: {},
          expiresAt: new Date(Date.now() - 1_000),
        },
      ],
    });

    const result = { id: 'appointment-1' };
    await expect(
      service.execute({ ...base, key: 'key-1', action: async () => result }),
    ).resolves.toEqual(result);

    expect(remove).toHaveBeenCalledWith({ id: 'idem-1' });
    expect(update).toHaveBeenCalledWith('idem-2', {
      statusCode: 201,
      response: result,
    });
  });
});
