import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Professional } from '../../../professionals/domain/professional.entity';
import { Clinic } from '../../clinic/domain/clinic.entity';

/**
 * Plantilla de horario base semanal de un médico/profesional kinesiólogo.
 * Define la disponibilidad recurrente (ej. Lunes de 08:00 a 12:00, franjas de 60 min).
 * ISO weekday: 1 = Lunes, 2 = Martes, ..., 7 = Domingo.
 */
@Entity('doctor_schedule_templates')
export class DoctorScheduleTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Día de la semana en formato ISO (1 = Lunes ... 7 = Domingo) */
  @Column({ type: 'int' })
  dayOfWeek: number;

  /** Hora de inicio en formato HH:mm:ss o HH:mm (ej. '08:00:00') */
  @Column({ type: 'time' })
  startTime: string;

  /** Hora de fin en formato HH:mm:ss o HH:mm (ej. '12:00:00') */
  @Column({ type: 'time' })
  endTime: string;

  /** Duración de cada slot/turno en minutos (por defecto 60 min) */
  @Column({ type: 'int', default: 60 })
  slotDurationMinutes: number;

  /** Capacidad máxima de pacientes por turno/slot (por defecto 1) */
  @Column({ type: 'int', default: 1 })
  maxCapacityPerSlot: number;

  /** Profesional/Médico asociado a esta plantilla */
  @ManyToOne(() => Professional, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'professionalId' })
  professional: Professional;

  @Column({ nullable: false })
  professionalId: string;

  /** Clínica asociada (opcional) */
  @ManyToOne('Clinic', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clinicId' })
  clinic?: Clinic;

  @Column({ nullable: true })
  clinicId?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
