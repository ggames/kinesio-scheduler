import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../../core/http/dto/pagination-query.dto';
import { EmailOutboxStatus } from '../../../../core/mail/domain/email-outbox.entity';

export class OutboxQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EmailOutboxStatus })
  @IsOptional()
  @IsIn(Object.values(EmailOutboxStatus))
  status?: EmailOutboxStatus;
}
