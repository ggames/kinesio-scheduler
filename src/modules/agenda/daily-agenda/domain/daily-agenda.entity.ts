import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Professional } from '../../../professionals/domain/professional.entity';
import type { TimeSlot } from '../../time-slot/domain/time-slot.entity';

@Entity('daily_agendas')
@Index(['professionalId', 'date'], { unique: true })
export class DailyAgenda {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Professional, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'professionalId' })
  professional: Professional;

  @Column({ nullable: false })
  professionalId: string;

  @Column({ type: 'date' })
  date: Date;

  @OneToMany('TimeSlot', (slot: any) => slot.agenda)
  slots: TimeSlot[];
}
