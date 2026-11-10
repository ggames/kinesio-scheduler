import { IsUUID, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvoiceItemDto {
  @ApiProperty({ example: 'Consulta kinesiológica', description: 'Descripción del ítem' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 1, description: 'Cantidad' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 5000, description: 'Precio unitario' })
  @IsNumber()
  unitPrice: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 'patient-uuid', description: 'Paciente UUID' })
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional({ example: 'clinic-uuid', description: 'Clínica UUID' })
  @IsUUID()
  @IsOptional()
  clinicId?: string | null;

  @ApiProperty({ type: [CreateInvoiceItemDto], description: 'Ítems de la factura' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];

  @ApiPropertyOptional({ example: 'CASH', description: 'Método de pago' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
