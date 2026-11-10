import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { Clinic } from '../../agenda/clinic/domain/clinic.entity';

@Entity('clinical_attachments')
@Index('IDX_clinical_attachments_patientId', ['patientId'])
export class ClinicalAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne('Clinic')
  @JoinColumn({ name: 'clinicId' })
  clinic?: Clinic;

  @Index('IDX_clinical_attachments_clinicId')
  @Column({ type: 'uuid' })
  clinicId: string;

  @Column({ type: 'uuid', nullable: true })
  appointmentId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  treatmentId?: string | null;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 128 })
  mimeType: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  checksum?: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  storageKey?: string | null;

  @Column({ type: 'varchar', length: 512 })
  storagePath: string;

  @Column({ type: 'uuid', nullable: true })
  uploadedByUserId?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
