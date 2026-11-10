import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReportFilterDto } from './dto/report-filter.dto';

export interface ReporteAusentismoItem {
  pacienteId: string;
  nombrePaciente: string;
  dni: string;
  telefono: string;
  tipoInasistencia: 'AUSENTE_SIN_AVISO' | 'ABANDONO_TRATAMIENTO';
  motivoODetalle: string;
  ultimaSesionFecha: string;
  sesionesRealizadas: number;
  totalSesionesProgramadas: number;
  profesionalAsignado: string;
  tratamientoNombre: string;
}

export interface DesgloseKinesiologoOcupacion {
  kinesiologoId: string;
  nombreCompleto: string;
  especialidad: string;
  turnosAsignados: number;
  turnosCompletados: number;
  turnosOciosos: number;
  capacidadTotal: number;
  porcentajeOcupacion: number;
}

export interface ReporteOcupacionAgenda {
  totalCuposOfrecidos: number;
  cuposReservados: number;
  cuposOciosos: number;
  porcentajeOcupacion: number;
  porcentajeOciosidad: number;
  desglosePorKinesiologo: DesgloseKinesiologoOcupacion[];
}

interface CapacidadRow {
  kinesiologoId: string;
  nombreCompleto: string;
  especialidad: string;
  capacidadTotal: number | string;
}

interface TurnosRow {
  kinesiologoId: string;
  nombreCompleto: string;
  especialidad: string;
  turnosAsignados: number | string;
  turnosCompletados: number | string;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Reporte 1: ausentismo (NO_SHOW) y abandono de tratamiento.
   * Usa agregación SQL y datos reales de treatment_sessions.
   */
  async obtenerAusentismoYAbandono(
    filter: ReportFilterDto,
    clinicId?: string | null,
  ): Promise<ReporteAusentismoItem[]> {
    const params = [
      filter.fechaInicio ?? null,
      filter.fechaFin ?? null,
      filter.professionalId ?? null,
      clinicId ?? null,
    ];

    const ausencias: ReporteAusentismoItem[] = await this.dataSource.query(
      `SELECT
          a."patientId" AS "pacienteId",
          TRIM(CONCAT(pp."firstName", ' ', pp."lastName")) AS "nombrePaciente",
          COALESCE(pp."documentId", 'S/D') AS "dni",
          COALESCE(pp."phone", 'N/A') AS "telefono",
          'AUSENTE_SIN_AVISO' AS "tipoInasistencia",
          CONCAT('Registra ', COUNT(*)::int, ' ausencia(s) sin aviso previo.') AS "motivoODetalle",
          MAX(da.date)::text AS "ultimaSesionFecha",
          COALESCE(COUNT(DISTINCT s.id)::int, 0) AS "sesionesRealizadas",
          COALESCE(t."totalSessions", 10) AS "totalSesionesProgramadas",
          COALESCE(
            'Lic. ' || TRIM(CONCAT(prp."firstName", ' ', prp."lastName")),
            'Profesional Kinesiólogo'
          ) AS "profesionalAsignado",
          COALESCE(t.description, 'Rehabilitación Kinesiológica') AS "tratamientoNombre"
        FROM appointments a
        JOIN time_slots ts ON ts.id = a."timeSlotId"
        JOIN daily_agendas da ON da.id = ts."agendaId"
        JOIN patients pa ON pa.id = a."patientId"
        JOIN persons pp ON pp.id = pa."personId"
        JOIN professionals pr ON pr.id = a."professionalId"
        JOIN persons prp ON prp.id = pr."personId"
        LEFT JOIN treatments t ON t.id = a."treatmentId"
        LEFT JOIN treatment_sessions s ON s."treatmentId" = t.id AND s.status = 'COMPLETED'
        WHERE a.status = 'NO_SHOW'
          AND ($1::date IS NULL OR da.date >= $1::date)
          AND ($2::date IS NULL OR da.date <= $2::date)
          AND ($3::uuid IS NULL OR a."professionalId" = $3::uuid)
          AND ($4::uuid IS NULL OR a."clinicId" = $4::uuid)
        GROUP BY
          a."patientId", pp."firstName", pp."lastName", pp."documentId", pp."phone",
          a."treatmentId", a."professionalId", t."totalSessions", t.description,
          prp."firstName", prp."lastName"
        ORDER BY MAX(da.date) DESC`,
      params,
    );

    const abandonos: ReporteAusentismoItem[] = await this.dataSource.query(
      `SELECT
         t."patientId" AS "pacienteId",
         TRIM(CONCAT(pp."firstName", ' ', pp."lastName")) AS "nombrePaciente",
         COALESCE(pp."documentId", 'S/D') AS "dni",
         COALESCE(pp."phone", 'N/A') AS "telefono",
         'ABANDONO_TRATAMIENTO' AS "tipoInasistencia",
         CONCAT(
           'Abandono prematuro: ', COUNT(s.id)::int, ' de ',
           t."totalSessions", ' sesiones realizadas sin alta médica.'
         ) AS "motivoODetalle",
         COALESCE(MAX(s."completedAt")::text, t."startDate"::text, '') AS "ultimaSesionFecha",
         COUNT(s.id)::int AS "sesionesRealizadas",
         t."totalSessions" AS "totalSesionesProgramadas",
         'Lic. ' || TRIM(CONCAT(prp."firstName", ' ', prp."lastName")) AS "profesionalAsignado",
         t.description AS "tratamientoNombre"
       FROM treatments t
       JOIN patients pa ON pa.id = t."patientId"
       JOIN persons pp ON pp.id = pa."personId"
       JOIN professionals pr ON pr.id = t."prescribingProfessionalId"
       JOIN persons prp ON prp.id = pr."personId"
       LEFT JOIN treatment_sessions s
         ON s."treatmentId" = t.id AND s.status = 'COMPLETED'
       WHERE t.status = 'ACTIVE'
         AND ($1::date IS NULL OR t."startDate" >= $1::date)
         AND ($2::date IS NULL OR t."startDate" <= $2::date)
         AND ($3::uuid IS NULL OR t."prescribingProfessionalId" = $3::uuid)
         AND NOT EXISTS (
           SELECT 1
           FROM appointments a
           JOIN time_slots ts ON ts.id = a."timeSlotId"
           JOIN daily_agendas da ON da.id = ts."agendaId"
           WHERE a."treatmentId" = t.id
             AND a.status IN ('SCHEDULED', 'CONFIRMED')
             AND da.date >= CURRENT_DATE
         )
       GROUP BY
         t.id, t."patientId", pp."firstName", pp."lastName", pp."documentId",
         pp."phone", t."totalSessions", t.description, t."startDate",
         prp."firstName", prp."lastName"
       HAVING COUNT(s.id) > 0 AND COUNT(s.id) < t."totalSessions"
       ORDER BY MAX(s."completedAt") ASC NULLS FIRST`,
      params,
    );

    return [...ausencias, ...abandonos].map((item) => ({
      ...item,
      ultimaSesionFecha: item.ultimaSesionFecha
        ? String(item.ultimaSesionFecha).slice(0, 10)
        : '',
      sesionesRealizadas: Number(item.sesionesRealizadas),
      totalSesionesProgramadas: Number(item.totalSesionesProgramadas),
    }));
  }

  /**
   * Reporte 2: ocupación real por profesional.
   * Capacidad = suma de maxCapacity de los slots. Reservas = turnos no cancelados.
   */
  async obtenerOcupacionAgenda(
    filter: ReportFilterDto,
    clinicId?: string | null,
  ): Promise<ReporteOcupacionAgenda> {
    const params = [
      filter.fechaInicio ?? null,
      filter.fechaFin ?? null,
      filter.professionalId ?? null,
      clinicId ?? null,
    ];

    const capacidades: CapacidadRow[] = await this.dataSource.query(
      `SELECT
          da."professionalId" AS "kinesiologoId",
          TRIM(CONCAT(pp."firstName", ' ', pp."lastName")) AS "nombreCompleto",
          COALESCE(pr.specialty, 'Kinesiología General') AS "especialidad",
          COALESCE(SUM(ts."maxCapacity"), 0)::int AS "capacidadTotal"
        FROM time_slots ts
        JOIN daily_agendas da ON da.id = ts."agendaId"
        JOIN professionals pr ON pr.id = da."professionalId"
        JOIN persons pp ON pp.id = pr."personId"
        LEFT JOIN (
          SELECT DISTINCT a2."professionalId" 
          FROM appointments a2 
          WHERE a2."clinicId" = $4::uuid
        ) clinic_prof ON clinic_prof."professionalId" = da."professionalId"
        WHERE ($1::date IS NULL OR da.date >= $1::date)
          AND ($2::date IS NULL OR da.date <= $2::date)
          AND ($3::uuid IS NULL OR da."professionalId" = $3::uuid)
          AND ($4::uuid IS NULL OR clinic_prof."professionalId" IS NOT NULL)
        GROUP BY da."professionalId", pp."firstName", pp."lastName", pr.specialty`,
      params,
    );

    const turnos: TurnosRow[] = await this.dataSource.query(
      `SELECT
         a."professionalId" AS "kinesiologoId",
         TRIM(CONCAT(pp."firstName", ' ', pp."lastName")) AS "nombreCompleto",
         COALESCE(pr.specialty, 'Kinesiología General') AS "especialidad",
         COUNT(*)::int AS "turnosAsignados",
         COUNT(*) FILTER (WHERE a.status = 'COMPLETED')::int AS "turnosCompletados"
       FROM appointments a
       JOIN time_slots ts ON ts.id = a."timeSlotId"
       JOIN daily_agendas da ON da.id = ts."agendaId"
       JOIN professionals pr ON pr.id = a."professionalId"
       JOIN persons pp ON pp.id = pr."personId"
       WHERE a.status <> 'CANCELLED'
         AND ($1::date IS NULL OR da.date >= $1::date)
         AND ($2::date IS NULL OR da.date <= $2::date)
         AND ($3::uuid IS NULL OR a."professionalId" = $3::uuid)
         AND ($4::uuid IS NULL OR a."clinicId" = $4::uuid)
       GROUP BY a."professionalId", pp."firstName", pp."lastName", pr.specialty`,
      params,
    );

    const byProfessional = new Map<string, DesgloseKinesiologoOcupacion>();

    for (const row of capacidades) {
      byProfessional.set(row.kinesiologoId, {
        kinesiologoId: row.kinesiologoId,
        nombreCompleto: row.nombreCompleto,
        especialidad: row.especialidad,
        turnosAsignados: 0,
        turnosCompletados: 0,
        turnosOciosos: 0,
        capacidadTotal: Number(row.capacidadTotal),
        porcentajeOcupacion: 0,
      });
    }

    for (const row of turnos) {
      const current = byProfessional.get(row.kinesiologoId) ?? {
        kinesiologoId: row.kinesiologoId,
        nombreCompleto: row.nombreCompleto,
        especialidad: row.especialidad,
        turnosAsignados: 0,
        turnosCompletados: 0,
        turnosOciosos: 0,
        capacidadTotal: 0,
        porcentajeOcupacion: 0,
      };
      current.turnosAsignados = Number(row.turnosAsignados);
      current.turnosCompletados = Number(row.turnosCompletados);
      byProfessional.set(row.kinesiologoId, current);
    }

    const desglose = [...byProfessional.values()].map((item) => {
      const turnosOciosos = Math.max(
        0,
        item.capacidadTotal - item.turnosAsignados,
      );
      const porcentajeOcupacion =
        item.capacidadTotal > 0
          ? Number(
              ((item.turnosAsignados / item.capacidadTotal) * 100).toFixed(1),
            )
          : 0;
      return { ...item, turnosOciosos, porcentajeOcupacion };
    });

    const totalCuposOfrecidos = desglose.reduce(
      (sum, item) => sum + item.capacidadTotal,
      0,
    );
    const cuposReservados = desglose.reduce(
      (sum, item) => sum + item.turnosAsignados,
      0,
    );
    const cuposOciosos = Math.max(0, totalCuposOfrecidos - cuposReservados);
    const porcentajeOcupacion =
      totalCuposOfrecidos > 0
        ? Number(((cuposReservados / totalCuposOfrecidos) * 100).toFixed(1))
        : 0;
    const porcentajeOciosidad =
      totalCuposOfrecidos > 0
        ? Number(((cuposOciosos / totalCuposOfrecidos) * 100).toFixed(1))
        : 0;

    return {
      totalCuposOfrecidos,
      cuposReservados,
      cuposOciosos,
      porcentajeOcupacion,
      porcentajeOciosidad,
      desglosePorKinesiologo: desglose,
    };
  }

  /**
   * Reporte 3: cantidad de tratamientos agrupados por estado.
   */
  async obtenerResumenTratamientos(
    filter: ReportFilterDto,
    clinicId?: string | null,
  ): Promise<
    Array<{ status: string; total: number; porcentaje: number }>
  > {
    const rows: Array<{ status: string; total: number | string }> =
      await this.dataSource.query(
        `SELECT t.status AS status, COUNT(*)::int AS total
         FROM treatments t
         WHERE ($1::date IS NULL OR t."startDate" >= $1::date)
           AND ($2::date IS NULL OR t."startDate" <= $2::date)
           AND ($3::uuid IS NULL OR t."prescribingProfessionalId" = $3::uuid)
           AND ($4::uuid IS NULL OR t."clinicId" = $4::uuid)
         GROUP BY t.status
         ORDER BY t.status`,
        [
          filter.fechaInicio ?? null,
          filter.fechaFin ?? null,
          filter.professionalId ?? null,
          clinicId ?? null,
        ],
      );

    const total = rows.reduce((sum, row) => sum + Number(row.total), 0);
    return rows.map((row) => ({
      status: row.status,
      total: Number(row.total),
      porcentaje:
        total > 0 ? Number(((Number(row.total) / total) * 100).toFixed(1)) : 0,
    }));
  }
}
