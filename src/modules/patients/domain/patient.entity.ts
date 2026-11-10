import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Clinic } from '../../agenda/clinic/domain/clinic.entity';
import { HealthInsurance } from '../../health-insurances/domain/health-insurance.entity';
import type { MedicalHistory } from '../../medical-histories/domain/medical-history.entity';
import { Person, Gender } from '../../persons/domain/person.entity';

export { Gender };

/**
 * Patient entity representing the clinical and healthcare profile of a Person.
 */
@Entity('patients')
@Index('IDX_patients_archivedAt', ['archivedAt'])
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Person relation (groups all shared identity & contact attributes)
  @OneToOne(() => Person, (person) => person.patient, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'personId' })
  person: Person;

  @Column()
  personId: string;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  archivedByUserId?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Relation to Obra Social (single)
  @ManyToOne(() => HealthInsurance, { nullable: true })
  @JoinColumn({ name: 'obraSocialId' })
  obraSocial?: HealthInsurance;

  @Column({ nullable: true })
  obraSocialId?: string;

  // Relation to Prepaga (single)
  @ManyToOne(() => HealthInsurance, { nullable: true })
  @JoinColumn({ name: 'prepagaId' })
  prepaga?: HealthInsurance;

  @Column({ nullable: true })
  prepagaId?: string;

  // General health insurance relation (optional)
  @ManyToOne(() => HealthInsurance, { nullable: true })
  @JoinColumn({ name: 'healthInsuranceId' })
  healthInsurance?: HealthInsurance;

  @Column({ nullable: true })
  healthInsuranceId?: string;

  // Relation to MedicalHistory
  @OneToOne('MedicalHistory', (mh: any) => mh.patient, { nullable: true, cascade: true })
  medicalHistory?: MedicalHistory;

  // Relation to clinic (patient belongs to a clinic)
  @ManyToOne('Clinic', (clinic: any) => clinic.patients, { nullable: true })
  @JoinColumn({ name: 'clinicId' })
  clinic?: Clinic;

  @Column({ nullable: true })
  clinicId?: string;

  // Número de afiliado a la obra social/prepaga
  @Column({ type: 'varchar', length: 100, nullable: true })
  nroAfiliado?: string | null;
}
