import { IsString, IsNotEmpty, IsOptional, IsEmail, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProfessionalDto {
  @ApiPropertyOptional({ description: 'Existing Person UUID (if person already registered). When provided, documentId is optional.' })
  @IsUUID()
  @IsOptional()
  personId?: string;

  @ApiProperty({ example: 'Carlos', description: 'First name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Pérez', description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'Traumatología', description: 'Specialty' })
  @IsString()
  @IsNotEmpty()
  specialty: string;

  @ApiProperty({ example: '28765432', description: 'Document ID / DNI. Required if personId is not provided.' })
  @IsString()
  @IsNotEmpty()
  documentId: string;

  @ApiPropertyOptional({ example: 'MP-12345', description: 'Professional license number (Matrícula)' })
  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'carlos.perez@example.com', description: 'Email' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+5491112345678', description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;
}
