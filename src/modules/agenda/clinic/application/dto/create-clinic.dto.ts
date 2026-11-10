import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateClinicDto {
  @ApiPropertyOptional({ description: 'Clinic ID (optional when creating)' })
  @IsUUID()
  @IsOptional()
  id?: string;

  @ApiProperty({ example: 'Clínica Kinesiología Central', description: 'Name of the clinic' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateClinicDto extends PartialType(CreateClinicDto) {}