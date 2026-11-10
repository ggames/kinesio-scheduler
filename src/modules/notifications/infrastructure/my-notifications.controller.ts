import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MailService } from '../../../core/mail/mail.service';
import { PaginationQueryDto } from '../../../core/http/dto/pagination-query.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class MyNotificationsController {
  constructor(private readonly mailService: MailService) {}

  @Get('mine')
  @ApiOperation({ summary: 'List notifications sent to the authenticated user' })
  findMine(@Query() query: PaginationQueryDto, @Req() req: any) {
    return this.mailService.findOutbox({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: req.user?.email ?? '',
    });
  }
}
