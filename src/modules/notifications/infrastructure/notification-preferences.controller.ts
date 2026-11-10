import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationPreferencesService } from '../application/notification-preferences.service';
import { UpdateNotificationPreferencesDto } from '../application/dto/update-notification-preferences.dto';
import { User as CurrentUser } from '../../../core/auth/decorators/user.decorator';
import type { AuthenticatedUser } from '../../../core/auth/roles';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications/preferences')
export class NotificationPreferencesController {
  constructor(private readonly service: NotificationPreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get my notification preferences' })
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getOrCreate(user.userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update my notification preferences' })
  update(
    @Body() dto: UpdateNotificationPreferencesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(user.userId, dto);
  }
}
