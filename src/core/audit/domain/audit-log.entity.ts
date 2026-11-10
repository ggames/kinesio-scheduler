import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGIN_BLOCKED = 'LOGIN_BLOCKED',
  PATIENT_REGISTERED = 'PATIENT_REGISTERED',
  PROFESSIONAL_REGISTERED = 'PROFESSIONAL_REGISTERED',
  ACCOUNT_ACTIVATED = 'ACCOUNT_ACTIVATED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET = 'PASSWORD_RESET',
  LOGOUT = 'LOGOUT',
  LOGOUT_ALL = 'LOGOUT_ALL',
  REFRESH_TOKEN_REUSE = 'REFRESH_TOKEN_REUSE',
  APPOINTMENT_CREATED = 'APPOINTMENT_CREATED',
  APPOINTMENT_CONFIRMED = 'APPOINTMENT_CONFIRMED',
  APPOINTMENT_COMPLETED = 'APPOINTMENT_COMPLETED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  APPOINTMENT_NO_SHOW = 'APPOINTMENT_NO_SHOW',
  APPOINTMENT_RESCHEDULED = 'APPOINTMENT_RESCHEDULED',
  TREATMENT_CREATED = 'TREATMENT_CREATED',
  TREATMENT_COMPLETED = 'TREATMENT_COMPLETED',
  TREATMENT_SESSION_COMPLETED = 'TREATMENT_SESSION_COMPLETED',
  MEDICAL_HISTORY_CREATED = 'MEDICAL_HISTORY_CREATED',
  MEDICAL_HISTORY_UPDATED = 'MEDICAL_HISTORY_UPDATED',
  MEDICAL_HISTORY_ARCHIVED = 'MEDICAL_HISTORY_ARCHIVED',
  CLINICAL_NOTE_CREATED = 'CLINICAL_NOTE_CREATED',
  CLINICAL_NOTE_UPDATED = 'CLINICAL_NOTE_UPDATED',
  CLINICAL_NOTE_SIGNED = 'CLINICAL_NOTE_SIGNED',
  CLINICAL_NOTE_VIEWED = 'CLINICAL_NOTE_VIEWED',
  MEDICAL_HISTORY_VIEWED = 'MEDICAL_HISTORY_VIEWED',
  USER_UPDATED = 'USER_UPDATED',
  USER_SESSIONS_REVOKED = 'USER_SESSIONS_REVOKED',
  AUDIT_EXPORTED = 'AUDIT_EXPORTED',
  DATA_EXPORTED = 'DATA_EXPORTED',
  DATA_ANONYMIZED = 'DATA_ANONYMIZED',
  NOTIFICATION_RETRIED = 'NOTIFICATION_RETRIED',
}

@Entity('audit_logs')
@Index('IDX_audit_logs_eventType_createdAt', ['eventType', 'createdAt'])
@Index('IDX_audit_logs_actorUserId', ['actorUserId'])
@Index('IDX_audit_logs_clinicId', ['clinicId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  eventType: string;

  @Column({ type: 'uuid', nullable: true })
  actorUserId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  targetUserId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  clinicId?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip?: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  requestId?: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
