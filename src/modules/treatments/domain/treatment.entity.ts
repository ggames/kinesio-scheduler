import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
} from 'typeorm';
import { Patient } from '../../patients/domain/patient.entity';
import { Professional } from '../../professionals/domain/professional.entity';
import type { Clinic } from '../../agenda/clinic/domain/clinic.entity';

export enum TreatmentStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
}

@Entity('treatments')
@Index('IDX_treatments_patientId_status', ['patient', 'status'])
@Index('IDX_treatments_professionalId_status', ['prescribingProfessional', 'status'])
@Index('IDX_treatments_professionalId_patientId', ['prescribingProfessional', 'patient'])
@Check('CHK_treatments_total_sessions', '"totalSessions" > 0')
export class Treatment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient)
  @JoinColumn()
  patient: Patient;

  @ManyToOne(() => Professional)
  @JoinColumn()
  prescribingProfessional: Professional;

  @ManyToOne('Clinic')
  @JoinColumn({ name: 'clinicId' })
  clinic?: Clinic;

  @Column({ type: 'uuid' })
  clinicId: string;

  @Column()
  description: string;

  @Column({ type: 'int' })
  totalSessions: number;

  @Column({ type: 'varchar', default: TreatmentStatus.ACTIVE })
  status: TreatmentStatus;

  @Column({ type: 'date', nullable: true })
  startDate?: string | null;

  @Column({ type: 'date', nullable: true })
  endDate?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
