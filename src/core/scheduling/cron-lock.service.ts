import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { hostname } from 'os';
import { randomUUID } from 'crypto';

/**
 * Postgres-backed single-flight lock for scheduled tasks.
 * Safe across multiple application replicas. The lock is released in `finally`.
 */
@Injectable()
export class CronLockService {
  private readonly logger = new Logger(CronLockService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async runWithLock(
    name: string,
    ttlMs: number,
    task: () => Promise<void>,
  ): Promise<boolean> {
    const owner = `${hostname()}:${process.pid}:${randomUUID()}`;

    try {
      const result: unknown[] = await this.dataSource.query(
        `INSERT INTO "cron_locks" ("name", "lockedUntil", "lockedBy", "updatedAt")
         VALUES ($1, now() + ($2 || ' milliseconds')::interval, $3, now())
         ON CONFLICT ("name") DO UPDATE
           SET "lockedUntil" = EXCLUDED."lockedUntil",
               "lockedBy" = EXCLUDED."lockedBy",
               "updatedAt" = now()
           WHERE "cron_locks"."lockedUntil" < now()
         RETURNING "name"`,
        [name, ttlMs, owner],
      );

      if (!result || result.length === 0) {
        this.logger.debug(`Tarea ${name} omitida: lock activo`);
        return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo adquirir lock ${name}: ${message}`);
      return false;
    }

    try {
      await task();
      return true;
    } finally {
      try {
        await this.dataSource.query(
          `DELETE FROM "cron_locks" WHERE "name" = $1 AND "lockedBy" = $2`,
          [name, owner],
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`No se pudo liberar lock ${name}: ${message}`);
      }
    }
  }

  async acquire(name: string, ttlMs: number): Promise<string | null> {
    const owner = `${hostname()}:${process.pid}:${randomUUID()}`;
    const result: unknown[] = await this.dataSource.query(
      `INSERT INTO "cron_locks" ("name", "lockedUntil", "lockedBy", "updatedAt")
       VALUES ($1, now() + ($2 || ' milliseconds')::interval, $3, now())
       ON CONFLICT ("name") DO UPDATE
         SET "lockedUntil" = EXCLUDED."lockedUntil",
             "lockedBy" = EXCLUDED."lockedBy",
             "updatedAt" = now()
         WHERE "cron_locks"."lockedUntil" < now()
       RETURNING "name"`,
      [name, ttlMs, owner],
    );
    return result && result.length > 0 ? owner : null;
  }

  async release(name: string, owner: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM "cron_locks" WHERE "name" = $1 AND "lockedBy" = $2`,
      [name, owner],
    );
  }
}
