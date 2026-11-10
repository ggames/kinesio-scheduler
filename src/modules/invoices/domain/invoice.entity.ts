import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Clinic } from '../../agenda/clinic/domain/clinic.entity';
import { Patient } from '../../patients/domain/patient.entity';

export type InvoiceStatus = 'ISSUED' | 'PAID' | 'CANCELLED';

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'INSURANCE';

@Entity('invoices')
@Index('IDX_invoices_clinicId', ['clinicId'])
@Index('IDX_invoices_patientId', ['patientId'])
@Index('IDX_invoices_status', ['status'])
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  clinicId?: string | null;

  @ManyToOne(() => Clinic, { nullable: true })
  @JoinColumn({ name: 'clinicId' })
  clinic?: Clinic;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'varchar', length: 20, default: 'ISSUED' })
  status: InvoiceStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cae?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  caeExpirationAt?: Date | null;

  @Column({ type: 'boolean', default: false })
  isElectronic: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
