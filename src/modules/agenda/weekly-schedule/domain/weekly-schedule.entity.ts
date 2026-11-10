import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { TimeSlot } from '../../time-slot/domain/time-slot.entity';
import type { Clinic } from '../../clinic/domain/clinic.entity';

/**
 * Represents a day-of-week template for a clinic's available hours.
 * dayOfWeek: 1=Monday … 7=Sunday (ISO 8601 weekday).
 */
@Entity('weekly_schedules')
export class WeeklySchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** ISO weekday: 1 = Monday … 7 = Sunday */
  @Column({ type: 'int' })
  dayOfWeek: number;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  /** Duration of each generated time slot in minutes. */
  @Column({ default: 60 })
  slotDurationMinutes: number;

  /** Maximum concurrent bookings per generated slot. */
  @Column({ default: 1 })
  maxCapacityPerSlot: number;

  @ManyToOne('Clinic', (clinic: any) => clinic.weeklySchedules)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @OneToMany('TimeSlot', (slot: any) => slot.weeklySchedule)
  timeSlots: TimeSlot[];
}
