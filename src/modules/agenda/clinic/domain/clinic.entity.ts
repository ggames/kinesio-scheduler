import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import type { WeeklySchedule } from '../../weekly-schedule/domain/weekly-schedule.entity';
import type { Holiday } from '../../holiday/domain/holiday.entity';

/**
 * Represents a physical clinic location. All scheduling data (WeeklySchedule, Holiday)
 * is scoped to a specific clinic to support multi-clinic deployments.
 *
 * Note: the patients relation is declared as a lazy forward reference to avoid
 * a circular dependency between Clinic and Patient.
 */
@Entity('clinics')
export class Clinic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @OneToMany('WeeklySchedule', (schedule: any) => schedule.clinic)
  weeklySchedules: WeeklySchedule[];

  @OneToMany('Holiday', (holiday: any) => holiday.clinic)
  holidays: Holiday[];

  // Patients relation — typed as any[] to avoid circular import at module level.
  // TypeORM resolves the actual entity at runtime via the lazy callback.
  @OneToMany('Patient', 'clinic')
  patients: any[];
}
