import {
  IsDateString,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../http/dto/pagination-query.dto';
import { AuditEventType } from '../domain/audit-log.entity';

export class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AuditEventType })
  @IsOptional()
  @IsIn(Object.values(AuditEventType))
  eventType?: string;

  @ApiPropertyOptional({ description: 'Actor user UUID' })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({ description: 'Target user UUID' })
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @ApiPropertyOptional({ description: 'ISO date lower bound' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date upper bound' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
