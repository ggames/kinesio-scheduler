import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToOne, ManyToOne, JoinColumn, Index } from 'typeorm';
import type { Person } from '../../persons/domain/person.entity';
import type { Clinic } from '../../agenda/clinic/domain/clinic.entity';

export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity('users')
@Index('IDX_users_activationTokenHash', ['activationTokenHash'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ default: '' })
  passwordHash: string;

  @Column({ default: 'PATIENT' })
  role: string;

  @Column('simple-array', { nullable: true })
  roles?: string[];

  @Column({ type: 'varchar', default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  activationTokenHash?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  activationTokenExpiresAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  tokenVersion: number;

  @ManyToOne('Clinic', { nullable: true })
  @JoinColumn({ name: 'clinicId' })
  clinic?: Clinic | null;

  @Index('IDX_users_clinicId')
  @Column({ type: 'uuid', nullable: true })
  clinicId?: string | null;

  @OneToOne('Person', (person: any) => person.user)
  person?: Person;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
