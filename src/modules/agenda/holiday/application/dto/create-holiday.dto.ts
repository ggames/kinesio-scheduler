import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { HolidayType } from '../../domain/holiday.entity';

export class CreateHolidayDto {
  @ApiPropertyOptional({ description: 'Holiday ID (optional when creating)' })
  @IsUUID()
  @IsOptional()
  id?: string;

  @ApiProperty({ example: '2026-12-25', description: 'Holiday date (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ enum: HolidayType, example: HolidayType.TOTAL, description: 'Type of holiday: TOTAL or PARTIAL' })
  @IsEnum(HolidayType)
  @IsNotEmpty()
  type: HolidayType;

  @ApiPropertyOptional({ example: '08:00:00', description: 'Start time if PARTIAL' })
  @IsString()
  @IsOptional()
  partialStartTime?: string;

  @ApiPropertyOptional({ example: '12:00:00', description: 'End time if PARTIAL' })
  @IsString()
  @IsOptional()
  partialEndTime?: string;

  @ApiPropertyOptional({ description: 'Clinic ID' })
  @IsUUID()
  @IsOptional()
  clinicId?: string;
}

export class UpdateHolidayDto extends PartialType(CreateHolidayDto) {}