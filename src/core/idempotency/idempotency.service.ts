import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IdempotencyKey } from './domain/idempotency-key.entity';
import { sha256 } from '../utils/hash.util';

const TTL_MS = 24 * 60 * 60 * 1000;

export interface IdempotentOptions<T> {
  key?: string;
  userId: string;
  scope: string;
  payload: unknown;
  successStatus?: number;
  action: () => Promise<T>;
}

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async execute<T>(options: IdempotentOptions<T>): Promise<T> {
    const { key, userId, scope, payload, action } = options;
    if (!key) return action();
    if (key.length > 128) {
      throw new BadRequestException('Idempotency-Key excede 128 caracteres');
    }

    const requestHash = sha256(JSON.stringify(payload ?? {}));
    const expiresAt = new Date(Date.now() + TTL_MS);
    const repository = this.dataSource.getRepository(IdempotencyKey);

    for (let attempt = 0; attempt < 2; attempt++) {
      const inserted = await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(IdempotencyKey)
        .values({
          userId,
          key,
          scope,
          requestHash,
          statusCode: 0,
          expiresAt,
        })
        .orIgnore()
        .returning('id')
        .execute();

      if (inserted.raw && inserted.raw.length > 0) {
        const id = (inserted.raw[0] as { id: string }).id;
        try {
          const result = await action();
          await repository.update(id, {
            statusCode: options.successStatus ?? 201,
            response: JSON.parse(JSON.stringify(result)),
          });
          return result;
        } catch (error) {
          await repository.delete({ id });
          throw error;
        }
      }

      const existing = await repository.findOne({
        where: { userId, key, scope },
      });

      if (!existing) continue;

      if (existing.expiresAt.getTime() <= Date.now()) {
        await repository.delete({ id: existing.id });
        continue;
      }

      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          'Idempotency-Key ya utilizada con un payload diferente',
        );
      }

      if (existing.statusCode === 0 || existing.response === null) {
        throw new ConflictException(
          'Solicitud con esta Idempotency-Key en curso; reintente en unos segundos',
        );
      }

      return existing.response as T;
    }

    throw new ConflictException('No se pudo procesar la Idempotency-Key');
  }
}
