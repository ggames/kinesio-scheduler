import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Only fields that the user is allowed to update on their own profile.
 * Email, document and role changes are intentionally excluded.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Juan' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Pérez' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: '+5491112345678' })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Health Insurance / Obra Social ID' })
  @IsUUID()
  @IsOptional()
  healthInsuranceId?: string;

  @ApiPropertyOptional({ example: '12345678', description: 'Número de afiliado a la obra social/prepaga' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nroAfiliado?: string;
}
