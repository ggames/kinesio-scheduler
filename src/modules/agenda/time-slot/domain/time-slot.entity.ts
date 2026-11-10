import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import type { DailyAgenda } from '../../daily-agenda/domain/daily-agenda.entity';
import type { WeeklySchedule } from '../../weekly-schedule/domain/weekly-schedule.entity';
import type { DoctorScheduleTemplate } from '../../doctor-schedule-template/domain/doctor-schedule-template.entity';

export enum TimeSlotStatus {
  AVAILABLE = 'AVAILABLE',
  BOOKED = 'BOOKED',
  BLOCKED = 'BLOCKED',
  EXPIRED = 'EXPIRED',
}

/**
 * Celdas físicas de horarios para las agendas diarias.
 * Incluye un índice único compuesto (agendaId, startTime) para inserciones idempotentes.
 */
@Entity('time_slots')
@Index(['agendaId', 'startTime'], { unique: true })
@Index('IDX_time_slots_status', ['status'])
@Check(
  'CHK_time_slots_capacity',
  '"maxCapacity" > 0 AND "currentBookings" >= 0',
)
export class TimeSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('DailyAgenda', { nullable: true, eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agendaId' })
  agenda: DailyAgenda;

  @Column({ nullable: true })
  agendaId: string;

  @ManyToOne('WeeklySchedule', { nullable: true, eager: false })
  @JoinColumn()
  weeklySchedule?: WeeklySchedule;

  @ManyToOne('DoctorScheduleTemplate', { nullable: true, eager: false })
  @JoinColumn()
  doctorScheduleTemplate?: DoctorScheduleTemplate;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  /** Capacidad máxima de reservas simultáneas permitidas */
  @Column({ type: 'int', default: 6 })
  maxCapacity: number;

  /** Contador atómico de reservas activas */
  @Column({ type: 'int', default: 0 })
  currentBookings: number;

  /**
   * AVAILABLE (DISPONIBLE): Acepta nuevas reservas.
   * BOOKED (OCUPADO): Reservado por paciente.
   * BLOCKED (BLOQUEADO): Capacidad agotada o bloqueado por feriado/administrativo.
   */
  @Column({ type: 'varchar', default: TimeSlotStatus.AVAILABLE })
  status: string;
}
