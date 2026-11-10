import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Treatment } from './treatment.entity';
import { Appointment } from '../../appointments/domain/appointment.entity';

export enum TreatmentSessionStatus {
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('treatment_sessions')
@Index('IDX_treatment_sessions_treatmentId_sessionNumber', ['treatmentId', 'sessionNumber'], {
  unique: true,
})
@Index('IDX_treatment_sessions_appointmentId', ['appointmentId'], { unique: true })
export class TreatmentSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  treatmentId: string;

  @ManyToOne(() => Treatment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'treatmentId' })
  treatment: Treatment;

  @ManyToOne(() => Appointment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment;

  @Column({ type: 'uuid' })
  appointmentId: string;

  @Column({ type: 'int' })
  sessionNumber: number;

  @Column({ type: 'varchar', default: TreatmentSessionStatus.COMPLETED })
  status: TreatmentSessionStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
