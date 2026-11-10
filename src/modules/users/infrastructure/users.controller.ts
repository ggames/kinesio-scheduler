import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from '../application/users.service';
import {
  AdminUsersQueryDto,
  CreateAdminUserDto,
  UpdateUserAdminDto,
} from '../application/dto/admin-users.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { ADMIN } from '../../../core/auth/roles';
import { User as CurrentUser } from '../../../core/auth/decorators/user.decorator';
import type { AuthenticatedUser } from '../../../core/auth/roles';

@ApiTags('Users (admin)')
@ApiBearerAuth()
@Roles(ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users (paginated, searchable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, type: String })
  findAll(@Query() query: AdminUsersQueryDto) {
    return this.service.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a user with staff/admin roles' })
  create(@Body() dto: CreateAdminUserDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.service.createAdmin(dto, user?.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findAdminOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user email, roles or status' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserAdminDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.updateAdmin(id, dto, user?.userId);
  }

  @Post(':id/revoke-sessions')
  @ApiOperation({ summary: 'Revoke all active sessions for a user' })
  revokeSessions(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.service.revokeSessions(id, user?.userId);
  }
}
