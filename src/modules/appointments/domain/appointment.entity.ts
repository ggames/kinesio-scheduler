import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { Patient } from '../../patients/domain/patient.entity';
import { Professional } from '../../professionals/domain/professional.entity';
import { Resource } from '../../resources/domain/resource.entity';
import { TimeSlot } from '../../agenda/time-slot/domain/time-slot.entity';
import { Treatment } from '../../treatments/domain/treatment.entity';
import type { Clinic } from '../../agenda/clinic/domain/clinic.entity';

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
}

@Entity('appointments')
@Index('IDX_appointments_patientId', ['patient'])
@Index('IDX_appointments_professionalId', ['professional'])
@Index('IDX_appointments_timeSlotId', ['timeSlot'])
@Index('IDX_appointments_status', ['status'])
@Index('IDX_appointments_timeSlotId_status', ['timeSlot', 'status'])
@Index('IDX_appointments_patientId_status', ['patient', 'status'])
@Index('IDX_appointments_professionalId_status', ['professional', 'status'])
@Index('IDX_appointments_professionalId_patientId', ['professional', 'patient'])
@Check(
  'CHK_appointments_status',
  `"status" IN ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')`,
)
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient)
  @JoinColumn()
  patient: Patient;

  @ManyToOne(() => Professional)
  @JoinColumn()
  professional: Professional;

  @ManyToOne(() => Professional, { nullable: true })
  @JoinColumn({ name: 'attendedByProfessionalId' })
  attendedByProfessional?: Professional | null;

  @Column({ type: 'uuid', nullable: true })
  attendedByProfessionalId?: string | null;

  @ManyToOne(() => Resource, { nullable: true })
  @JoinColumn()
  resource?: Resource;

  @ManyToOne(() => TimeSlot)
  @JoinColumn()
  timeSlot: TimeSlot;

  @ManyToOne(() => Treatment, { nullable: true })
  @JoinColumn()
  treatment?: Treatment;

  @ManyToOne('Clinic')
  @JoinColumn({ name: 'clinicId' })
  clinic?: Clinic;

  @Column({ type: 'uuid' })
  clinicId: string;

  @Column({ type: 'varchar', default: AppointmentStatus.SCHEDULED })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  cancelledByUserId?: string | null;

  @Column({ type: 'text', nullable: true })
  cancellationReason?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  noShowAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  rescheduledAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  rescheduledByUserId?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reminderSentAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
