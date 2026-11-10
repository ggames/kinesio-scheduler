import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { Person } from '../../persons/domain/person.entity';

/**
 * Professional entity representing the practitioner/clinical profile of a Person.
 */
@Entity('professionals')
@Index('IDX_professionals_licenseNumber', ['licenseNumber'], { unique: true })
@Index('IDX_professionals_isActive', ['isActive'])
export class Professional {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Person relation (groups all shared identity & contact attributes)
  @OneToOne(() => Person, (person) => person.professional, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'personId' })
  person: Person;

  @Column()
  personId: string;

  @Column()
  specialty: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  licenseNumber?: string; // Matrícula profesional

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deactivatedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
