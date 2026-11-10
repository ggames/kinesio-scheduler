import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum EmailOutboxStatus {
  PENDING = 'PENDING',
  SENDING = 'SENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Entity('email_outbox')
@Index('IDX_email_outbox_status_nextAttemptAt', ['status', 'nextAttemptAt'])
@Index('IDX_email_outbox_sentAt', ['sentAt'])
@Index('IDX_email_outbox_clinicId', ['clinicId'])
export class EmailOutbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 320 })
  to: string;

  @Column({ type: 'varchar', length: 64 })
  template: string;

  @Column({ type: 'uuid', nullable: true })
  clinicId?: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 16, default: EmailOutboxStatus.PENDING })
  status: EmailOutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  nextAttemptAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
