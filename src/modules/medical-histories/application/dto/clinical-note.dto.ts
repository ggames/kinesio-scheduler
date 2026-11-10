import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClinicalNoteDto {
  @ApiProperty({ format: 'uuid', description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Professional UUID (required for ADMIN when not a professional)',
  })
  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Related appointment UUID' })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Related treatment UUID' })
  @IsOptional()
  @IsUUID()
  treatmentId?: string;

  @ApiProperty({
    description: 'Clinical note content',
    maxLength: 10000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;
}

export class UpdateClinicalNoteDto {
  @ApiProperty({ description: 'Clinical note content', maxLength: 10000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;
}

export class FindClinicalNotesQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by patient UUID' })
  @IsOptional()
  @IsUUID()
  patientId?: string;
}
