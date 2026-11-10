import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CronLockService } from '../../../../core/scheduling/cron-lock.service';

/**
 * Reconciliación diaria de datos derivados:
 * - Recalcula la caché time_slots.currentBookings.
 * - Cierra tratamientos activos que ya alcanzaron su total de sesiones.
 * - Reporta anomalías de sesiones por encima del total prescripto.
 */
@Injectable()
export class DataReconciliationTask {
  private readonly logger = new Logger(DataReconciliationTask.name);
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cronLock: CronLockService,
  ) {}

  @Cron('0 3 * * *')
  async reconcile(): Promise<void> {
    await this.cronLock.runWithLock(
      'appointments.reconciliation',
      30 * 60 * 1000,
      () => this.runReconciliation(),
    );
  }

  private async runReconciliation(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const updatedSlots: { id: string }[] = await this.dataSource.query(
        `WITH actual AS (
           SELECT ts.id,
                  COUNT(a.id) FILTER (
                    WHERE a.status IN ('SCHEDULED', 'CONFIRMED', 'COMPLETED')
                  )::int AS active
           FROM time_slots ts
           LEFT JOIN appointments a ON a."timeSlotId" = ts.id
           GROUP BY ts.id
         )
         UPDATE time_slots ts
         SET "currentBookings" = actual.active,
             "status" = CASE
               WHEN ts.status IN ('BLOCKED', 'EXPIRED') THEN ts.status
               WHEN actual.active >= ts."maxCapacity" THEN 'BOOKED'
               ELSE 'AVAILABLE'
             END
         FROM actual
         WHERE ts.id = actual.id
           AND (
             ts."currentBookings" <> actual.active
             OR (
               ts.status NOT IN ('BLOCKED', 'EXPIRED')
               AND ts.status <> CASE
                 WHEN actual.active >= ts."maxCapacity" THEN 'BOOKED'
                 ELSE 'AVAILABLE'
               END
             )
           )
         RETURNING ts.id`,
      );

      const completedTreatments: { id: string }[] = await this.dataSource.query(
        `UPDATE treatments t
         SET status = 'COMPLETED',
             "endDate" = COALESCE(t."endDate", CURRENT_DATE),
             "updatedAt" = now()
         WHERE t.status = 'ACTIVE'
           AND (
             SELECT COUNT(*)
             FROM treatment_sessions s
             WHERE s."treatmentId" = t.id
               AND s.status = 'COMPLETED'
           ) >= t."totalSessions"
         RETURNING t.id`,
      );

      const overbooked: { id: string; totalSessions: number; sessions: number }[] =
        await this.dataSource.query(
          `SELECT t.id, t."totalSessions", COUNT(s.id)::int AS sessions
           FROM treatments t
           JOIN treatment_sessions s
             ON s."treatmentId" = t.id AND s.status = 'COMPLETED'
           GROUP BY t.id, t."totalSessions"
           HAVING COUNT(s.id) > t."totalSessions"`,
        );

      if (updatedSlots.length > 0) {
        this.logger.log(`Slots reconciliados: ${updatedSlots.length}`);
      }
      if (completedTreatments.length > 0) {
        this.logger.log(
          `Tratamientos cerrados automáticamente: ${completedTreatments.length}`,
        );
      }
      if (overbooked.length > 0) {
        this.logger.error(
          `Tratamientos con sesiones excedidas: ${overbooked
            .map((item) => `${item.id} (${item.sessions}/${item.totalSessions})`)
            .join(', ')}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error en reconciliación de datos: ${message}`);
    } finally {
      this.running = false;
    }
  }
}
