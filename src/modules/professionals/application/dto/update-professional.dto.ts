import {
  IsString,
  IsOptional,
  IsEmail,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfessionalDto {
  @ApiPropertyOptional({ example: 'Carlos', description: 'First name' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Pérez', description: 'Last name' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: '28765432', description: 'Document ID / DNI' })
  @IsString()
  @IsOptional()
  documentId?: string;

  @ApiPropertyOptional({ example: 'Traumatología', description: 'Specialty' })
  @IsString()
  @IsOptional()
  specialty?: string;

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

  @ApiPropertyOptional({ description: 'Whether the professional is active' })
  @IsOptional()
  isActive?: boolean;
}
