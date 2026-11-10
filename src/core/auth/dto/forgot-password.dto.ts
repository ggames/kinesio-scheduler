import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Correo electrónico del usuario' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
