import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity('token_blacklist')
export class TokenBlacklist {
  @PrimaryColumn({ type: 'varchar', length: 1024 })
  token: string;

  @Index('IDX_token_blacklist_expiresAt')
  @Column({ type: 'timestamptz' })
  expiresAt: Date;
}
