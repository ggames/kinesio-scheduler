import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryColumn('uuid')
  userId: string;

  @Column({ type: 'boolean', default: true })
  emailEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  appointmentReminders: boolean;

  @Column({ type: 'boolean', default: true })
  appointmentChanges: boolean;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
