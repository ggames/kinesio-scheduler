import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateMedicalHistoryDto {
  @ApiProperty({ description: 'UUID of the patient' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiPropertyOptional({ example: 'HC-2026-001', description: 'Medical record number (Número de historia clínica)' })
  @IsString()
  @IsOptional()
  medicalRecordNumber?: string;

  @ApiPropertyOptional({ example: 'Lumbago agudo post-esfuerzo', description: 'Primary diagnosis (Diagnóstico)' })
  @IsString()
  @IsOptional()
  diagnosis?: string;

  @ApiPropertyOptional({ example: 'Dr. Pérez (Traumatología)', description: 'Referring doctor (Médico derivante)' })
  @IsString()
  @IsOptional()
  referringDoctor?: string;

  @ApiPropertyOptional({ example: 'orden_medica_123.pdf', description: 'Medical referral document reference (Orden médica)' })
  @IsString()
  @IsOptional()
  medicalReferralDocument?: string;

  @ApiPropertyOptional({ example: 'Paciente refiere dolor lumbar de 3 semanas de evolución sin irradiación.', description: 'Detailed medical history notes (Historia clínica / Anamnesis)' })
  @IsString()
  @IsOptional()
  medicalHistory?: string;
}

export class UpdateMedicalHistoryDto extends PartialType(CreateMedicalHistoryDto) {}
