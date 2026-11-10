import { IsInt, Min, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTimeSlotCapacityDto {
  @ApiProperty({ example: 5, description: 'Nueva capacidad máxima de reservas permitidas' })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  maxCapacity: number;
}
