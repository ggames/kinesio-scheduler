import { IsString, MaxLength, MinLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token de recuperación de contraseña' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'Nueva contraseña' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @IsNotEmpty()
  password: string;
}
