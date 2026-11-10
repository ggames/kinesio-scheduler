import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Invoice } from './invoice.entity';

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

@Entity('payments')
@Index('IDX_payments_invoiceId', ['invoiceId'])
@Index('IDX_payments_status', ['status'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice)
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column({ type: 'varchar', length: 32 })
  method: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 32, default: 'PENDING' })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
