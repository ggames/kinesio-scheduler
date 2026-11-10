import { IsUUID, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Patient UUID' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Professional / Doctor UUID' })
  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @ApiProperty({ format: 'uuid', description: 'TimeSlot UUID' })
  @IsUUID()
  @IsNotEmpty()
  timeSlotId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Optional treatment plan UUID' })
  @IsOptional()
  @IsUUID()
  treatmentId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Optional clinic UUID (defaults to the patient clinic)' })
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @ApiPropertyOptional({
    description: 'Fecha deseada para la cita en formato ISO 8601 (YYYY-MM-DD o ISO DateTime)',
    example: '2026-09-15T09:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  appointmentDate?: string;
}
