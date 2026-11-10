import { IsInt, IsString, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateWeeklyScheduleDto {
  /** 1 = Monday … 7 = Sunday */
  @ApiProperty({ minimum: 1, maximum: 7, example: 1, description: 'ISO weekday (1=Monday...7=Sunday)' })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ example: '08:00:00', description: 'Start time (HH:mm:ss)' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '18:00:00', description: 'End time (HH:mm:ss)' })
  @IsString()
  endTime: string;

  @ApiPropertyOptional({ default: 60, description: 'Duration of each slot in minutes' })
  @IsInt()
  @IsOptional()
  slotDurationMinutes?: number;

  @ApiPropertyOptional({ default: 1, description: 'Max capacity per slot' })
  @IsInt()
  @IsOptional()
  maxCapacityPerSlot?: number;
}

export class UpdateWeeklyScheduleDto extends PartialType(CreateWeeklyScheduleDto) {}
