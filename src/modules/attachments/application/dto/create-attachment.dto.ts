import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAttachmentDto {
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

  @ApiProperty({ example: 'informe.pdf', description: 'Original file name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ example: 'application/pdf', description: 'MIME type' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  mimeType: string;

  @ApiProperty({ description: 'File content encoded as base64' })
  @IsString()
  @IsNotEmpty()
  contentBase64: string;
}
