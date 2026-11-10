import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('refresh_tokens')
@Index('IDX_refresh_tokens_userId', ['userId'])
@Index('IDX_refresh_tokens_tokenHash', ['tokenHash'], { unique: true })
@Index('IDX_refresh_tokens_familyId', ['familyId'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'uuid' })
  familyId: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  replacedByTokenId?: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
