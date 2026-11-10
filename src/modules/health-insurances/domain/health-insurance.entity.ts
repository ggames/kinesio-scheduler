import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('health_insurances')
export class HealthInsurance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  coverageDetails: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
