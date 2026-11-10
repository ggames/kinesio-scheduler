import { IsString, IsNotEmpty, IsStrongPassword, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for account activation: setting password via temporary activation token.
 */
export class ActivateAccountDto {
  @ApiProperty({ description: 'Temporary activation token received by email (valid 24h)' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: 'NewPassword123!',
    minLength: 8,
    description: 'New password set by the user (min 8, upper/lowercase and number)',
  })
  @IsString()
  @IsNotEmpty()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 0,
  })
  @MaxLength(72)
  password: string;
}
