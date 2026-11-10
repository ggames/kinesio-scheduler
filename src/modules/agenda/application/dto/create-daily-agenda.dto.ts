import { IsUUID, IsDateString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDailyAgendaDto {
  @ApiProperty({ format: 'uuid', description: 'Professional UUID' })
  @IsUUID()
  @IsNotEmpty()
  professionalId: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional({ default: 8, description: 'Start hour for generation (0-23)' })
  @IsInt()
  @Min(0)
  @Max(23)
  @IsOptional()
  startHour?: number;

  @ApiPropertyOptional({ default: 18, description: 'End hour for generation (1-24)' })
  @IsInt()
  @Min(1)
  @Max(24)
  @IsOptional()
  endHour?: number;

  @ApiPropertyOptional({ default: 1, description: 'Max concurrent appointments per slot' })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxCapacity?: number;
}
