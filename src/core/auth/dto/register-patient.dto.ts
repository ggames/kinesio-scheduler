import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsStrongPassword,
  MaxLength,
  IsOptional,
  IsDateString,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '../../../modules/persons/domain/person.entity';

/**
 * DTO for double registration: User Auth account + Patient profile.
 */
export class RegisterPatientDto {
  // Auth fields
  @ApiProperty({ example: 'paciente@example.com', description: 'User account email for authentication' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'Password123!',
    minLength: 8,
    description: 'User account password (min 8, upper/lowercase and number)',
  })
  @IsString()
  @IsNotEmpty()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 0,
  })
  @MaxLength(72)
  password: string;

  // Patient personal data
  @ApiProperty({ example: 'Juan', description: 'Patient first name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Pérez', description: 'Patient last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: '12345678', description: 'DNI / Document ID' })
  @IsString()
  @IsNotEmpty()
  documentId: string;

  @ApiPropertyOptional({ type: String, format: 'date', example: '1992-08-20', description: 'Birth date (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({ enum: Gender, example: Gender.MALE, description: 'Gender' })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({ example: '+5491112345678', description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Av. Cabildo 500', description: 'Address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'María Pérez', description: 'Emergency contact name' })
  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '+5491187654321', description: 'Emergency contact phone' })
  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ description: 'Optional clinic ID to associate' })
  @IsUUID()
  @IsOptional()
  clinicId?: string;
}
