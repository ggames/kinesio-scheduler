import { IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadAttachmentDto {
  @ApiProperty({ format: 'uuid', description: 'Patient UUID' })
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Optional appointment UUID' })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Optional treatment UUID' })
  @IsOptional()
  @IsUUID()
  treatmentId?: string;
}
