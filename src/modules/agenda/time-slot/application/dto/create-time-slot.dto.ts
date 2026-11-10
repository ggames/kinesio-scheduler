import { IsString, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateTimeSlotDto {
  @ApiPropertyOptional({ description: 'UUID of the DailyAgenda this slot belongs to' })
  @IsUUID()
  @IsOptional()
  agendaId?: string;

  @ApiPropertyOptional({ description: 'UUID of the WeeklySchedule this slot belongs to' })
  @IsUUID()
  @IsOptional()
  weeklyScheduleId?: string;

  @ApiProperty({ example: '09:00:00', description: 'Start time (HH:mm:ss)' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '10:00:00', description: 'End time (HH:mm:ss)' })
  @IsString()
  endTime: string;

  @ApiPropertyOptional({ default: 1, description: 'Max concurrent capacity' })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxCapacity?: number;
}

export class UpdateTimeSlotDto extends PartialType(CreateTimeSlotDto) {}
