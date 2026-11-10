import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsEmail,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '../../../persons/domain/person.entity';

export class UpdatePatientDto {
  @ApiPropertyOptional({ example: 'Juan', description: 'Patient first name' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Pérez', description: 'Patient last name' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: '12345678', description: 'Document ID / DNI' })
  @IsString()
  @IsOptional()
  documentId?: string;

  @ApiPropertyOptional({ type: String, format: 'date', example: '1990-05-15' })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({ example: 'Av. Corrientes 1234', description: 'Address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: '+5491112345678', description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'juan.perez@example.com', description: 'Email address' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'María Pérez', description: 'Emergency contact name' })
  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '+5491187654321', description: 'Emergency contact phone' })
  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ description: 'Health Insurance ID' })
  @IsUUID()
  @IsOptional()
  healthInsuranceId?: string;

  @ApiPropertyOptional({ description: 'Obra Social ID' })
  @IsUUID()
  @IsOptional()
  obraSocialId?: string;

  @ApiPropertyOptional({ description: 'Prepaga ID' })
  @IsUUID()
  @IsOptional()
  prepagaId?: string;

  @ApiPropertyOptional({ description: 'Clinic ID' })
  @IsUUID()
  @IsOptional()
  clinicId?: string;

  @ApiPropertyOptional({ example: '12345678', description: 'Número de afiliado a la obra social/prepaga' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nroAfiliado?: string;
}
