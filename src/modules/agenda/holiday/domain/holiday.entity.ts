import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import type { Clinic } from '../../clinic/domain/clinic.entity';

export enum HolidayType {
  TOTAL = 'TOTAL',
  PARTIAL = 'PARTIAL',
}

/**
 * Represents a holiday or special exception for a specific date.
 * TOTAL: entire day blocked.
 * PARTIAL: only a portion of the day is blocked – custom start/end times are used.
 */
@Entity('holidays')
export class Holiday {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', unique: true })
  date: string; // YYYY-MM-DD

  @Column({ type: 'varchar', default: HolidayType.TOTAL })
  type: HolidayType;

  // Used only when type === PARTIAL
  @Column({ type: 'time', nullable: true })
  partialStartTime?: string;

  @Column({ type: 'time', nullable: true })
  partialEndTime?: string;

  @ManyToOne('Clinic', (clinic: any) => clinic.holidays)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;
}
