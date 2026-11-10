import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
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

/**
 * Nota clínica asociada a un paciente y, opcionalmente, a un turno o tratamiento.
 * Una vez firmada (signedAt no nulo) es inmutable.
 */
@Entity('clinical_notes')
@Index('IDX_clinical_notes_patientId', ['patientId'])
@Index('IDX_clinical_notes_professionalId', ['professionalId'])
@Index('IDX_clinical_notes_signedAt', ['signedAt'])
@Check('CHK_clinical_notes_content', `length(trim("content")) > 0`)
export class ClinicalNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Professional, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'professionalId' })
  professional: Professional;

  @Column({ type: 'uuid' })
  professionalId: string;

  @ManyToOne('Clinic')
  @JoinColumn({ name: 'clinicId' })
  clinic?: Clinic;

  @Index('IDX_clinical_notes_clinicId')
  @Column({ type: 'uuid' })
  clinicId: string;

  @Column({ type: 'uuid', nullable: true })
  appointmentId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  treatmentId?: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'timestamptz', nullable: true })
  signedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  signedByProfessionalId?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
