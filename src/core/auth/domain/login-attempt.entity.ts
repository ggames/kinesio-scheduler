import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  UpdateDateColumn,
} from 'typeorm';

@Entity('login_attempts')
@Index('IDX_login_attempts_emailHash', ['emailHash'], { unique: true })
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  emailHash: string;

  @Column({ type: 'int', default: 0 })
  failedAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  firstFailedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil?: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
