import { Equals, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AnonymizePatientDto {
  @ApiProperty({ description: 'Must be true to confirm irreversible anonymization' })
  @IsBoolean()
  @Equals(true, { message: 'confirm debe ser true para anonimizar' })
  confirm: boolean;
}
