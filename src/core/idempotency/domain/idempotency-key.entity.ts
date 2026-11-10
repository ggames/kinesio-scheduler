import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('idempotency_keys')
@Index('UQ_idempotency_keys_user_key_scope', ['userId', 'key', 'scope'], {
  unique: true,
})
@Index('IDX_idempotency_keys_expiresAt', ['expiresAt'])
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 128 })
  key: string;

  @Column({ type: 'varchar', length: 128 })
  scope: string;

  @Column({ type: 'varchar', length: 64 })
  requestHash: string;

  @Column({ type: 'int', default: 0 })
  statusCode: number;

  @Column({ type: 'jsonb', nullable: true })
  response?: unknown;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;
}
