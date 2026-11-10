import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentStatus } from '../../domain/appointment.entity';

export class CancelAppointmentDto {
  @ApiPropertyOptional({
    example: 'El paciente no puede asistir',
    description: 'Cancellation reason',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CompleteAppointmentDto {
  @ApiPropertyOptional({
    description: 'Clinical notes recorded when completing the appointment',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class RescheduleAppointmentDto {
  @ApiProperty({ format: 'uuid', description: 'New time slot UUID' })
  @IsUUID()
  timeSlotId: string;

  @ApiPropertyOptional({ example: 'Cambio de horario solicitado por el paciente' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class FindAppointmentsQueryDto {
  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsIn(Object.values(AppointmentStatus))
  status?: AppointmentStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
