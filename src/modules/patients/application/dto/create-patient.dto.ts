import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEmail, IsEnum, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '../../../persons/domain/person.entity';

export class CreatePatientDto {
  @ApiPropertyOptional({ description: 'Existing Person UUID (if person already registered)' })
  @IsUUID()
  @IsOptional()
  personId?: string;

  @ApiProperty({ example: 'Juan', description: 'Patient first name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Pérez', description: 'Patient last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: '12345678', description: 'Document ID / DNI' })
  @IsString()
  @IsNotEmpty()
  documentId: string;

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

  // Optional relation IDs
  @ApiPropertyOptional({ description: 'Health Insurance ID' })
  @IsString()
  @IsOptional()
  healthInsuranceId?: string;

  @ApiPropertyOptional({ description: 'Obra Social ID' })
  @IsString()
  @IsOptional()
  obraSocialId?: string;

  @ApiPropertyOptional({ description: 'Prepaga ID' })
  @IsString()
  @IsOptional()
  prepagaId?: string;

  @ApiPropertyOptional({ description: 'Clinic ID' })
  @IsString()
  @IsOptional()
  clinicId?: string;

  @ApiPropertyOptional({ example: '12345678', description: 'Número de afiliado a la obra social/prepaga' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nroAfiliado?: string;
}
