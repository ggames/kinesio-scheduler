import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Refresh token a revocar además del access token.' })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
