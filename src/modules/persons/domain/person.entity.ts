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
import { User } from '../../users/domain/user.entity';
import type { Patient } from '../../patients/domain/patient.entity';
import type { Professional } from '../../professionals/domain/professional.entity';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  NOT_SPECIFIED = 'NOT_SPECIFIED',
}

/**
 * Person entity grouping all shared personal identity and contact attributes
 * for both Patients and Professionals.
 */
@Entity('persons')
@Index('IDX_persons_archivedAt', ['archivedAt'])
export class Person {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string; // Nombre

  @Column({ type: 'varchar', length: 100 })
  lastName: string; // Apellido

  @Column({ type: 'varchar', length: 20, unique: true })
  documentId: string; // DNI o documento de identidad

  @Column({ type: 'date', nullable: true })
  birthDate?: string; // Fecha de nacimiento

  @Column({ type: 'varchar', default: Gender.NOT_SPECIFIED })
  gender: Gender;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string; // Número de contacto

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  email?: string; // Correo electrónico

  @Column({ type: 'varchar', length: 250, nullable: true })
  address?: string; // Dirección de residencia

  @Column({ type: 'varchar', length: 200, nullable: true })
  emergencyContactName?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  emergencyContactPhone?: string;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  archivedByUserId?: string | null;

  // Relation to User auth account (optional)
  @OneToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ nullable: true })
  userId?: string;

  // Relations to Patient and Professional roles
  @OneToOne('Patient', (patient: any) => patient.person, { nullable: true })
  patient?: Patient;

  @OneToOne('Professional', (professional: any) => professional.person, { nullable: true })
  professional?: Professional;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
