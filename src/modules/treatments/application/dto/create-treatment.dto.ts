import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTreatmentDto {
  @ApiProperty({ format: 'uuid', description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ format: 'uuid', description: 'Prescribing professional UUID' })
  @IsUUID()
  @IsNotEmpty()
  professionalId: string;

  @ApiProperty({ example: 'Kinesioterapia lumbar - 10 sesiones', description: 'Treatment description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 10, minimum: 1, description: 'Total number of sessions prescribed' })
  @IsInt()
  @Min(1)
  totalSessions: number;

  @ApiPropertyOptional({ example: '2026-09-01', description: 'Treatment start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Optional clinic UUID (defaults to the patient clinic)' })
  @IsOptional()
  @IsUUID()
  clinicId?: string;
}
