import { IsEmail, IsString, IsNotEmpty, IsArray, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PATIENT, STAFF } from '../roles';

/**
 * DTO for Admin registration of Professional profile and Auth User account.
 */
export class RegisterProfessionalDto {
  @ApiProperty({ example: 'dr.perez@example.com', description: 'Professional email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Carlos', description: 'First name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Pérez', description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: '28765432', description: 'Document ID / DNI' })
  @IsString()
  @IsNotEmpty()
  documentId: string;

  @ApiProperty({ example: 'MP-12345', description: 'Professional license number (Matrícula)' })
  @IsString()
  @IsNotEmpty()
  licenseNumber: string;

  @ApiProperty({ example: 'Traumatología y Fisioterapia', description: 'Specialty' })
  @IsString()
  @IsNotEmpty()
  specialty: string;

  @ApiPropertyOptional({
    example: ['STAFF', 'PATIENT'],
    description: 'Assigned roles. ADMIN cannot be assigned through this endpoint.',
  })
  @IsArray()
  @IsString({ each: true })
  @IsIn([STAFF, PATIENT], { each: true })
  @IsOptional()
  roles?: string[] = [STAFF];

  @ApiPropertyOptional({ example: '+5491112345678', description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;
}
