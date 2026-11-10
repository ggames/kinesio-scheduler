import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsEmail,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Gender } from '../../domain/person.entity';

export class CreatePersonDto {
  @ApiProperty({ example: 'Juan', description: 'First name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Pérez', description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: '12345678', description: 'DNI / Document ID' })
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

  @ApiPropertyOptional({ example: '+5491112345678' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'juan.perez@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'Av. Corrientes 1234' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'María Pérez' })
  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '+5491187654321' })
  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;
}

export class UpdatePersonDto extends PartialType(CreatePersonDto) {}
