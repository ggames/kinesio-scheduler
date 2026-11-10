import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import type { Patient } from '../../patients/domain/patient.entity';

@Entity('medical_histories')
@Index('IDX_medical_histories_patientId', ['patientId'])
@Index('IDX_medical_histories_archivedAt', ['archivedAt'])
export class MedicalHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  medicalRecordNumber?: string; // Número de historia clínica

  @Column({ type: 'text', nullable: true })
  diagnosis?: string; // Diagnóstico principal / motivo de consulta

  @Column({ type: 'varchar', length: 200, nullable: true })
  referringDoctor?: string; // Médico derivante

  @Column({ type: 'varchar', length: 255, nullable: true })
  medicalReferralDocument?: string; // Documento / Orden médica de derivación

  @Column({ type: 'text', nullable: true })
  medicalHistory?: string; // Anamnesis / Antecedentes médicos detallados

  @OneToOne('Patient', (patient: any) => patient.medicalHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ nullable: true })
  patientId?: string;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  archivedByUserId?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
