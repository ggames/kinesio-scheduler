import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { PersonsService } from '../application/persons.service';
import { CreatePersonDto, UpdatePersonDto } from '../application/dto/create-person.dto';
import { PaginationQueryDto } from '../../../core/http/dto/pagination-query.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { ADMIN, CLINIC_ADMIN, STAFF } from '../../../core/auth/roles';
import { User as CurrentUser } from '../../../core/auth/decorators/user.decorator';
import type { AuthenticatedUser } from '../../../core/auth/roles';

@ApiTags('Persons')
@ApiBearerAuth()
@Roles(ADMIN, CLINIC_ADMIN, STAFF)
@Controller('persons')
export class PersonsController {
  constructor(private readonly service: PersonsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new person' })
  @ApiBody({ type: CreatePersonDto })
  create(@Body() dto: CreatePersonDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List persons (paginated, searchable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get person by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a person' })
  @ApiBody({ type: UpdatePersonDto })
  update(@Param('id') id: string, @Body() dto: UpdatePersonDto) {
    return this.service.update(id, dto);
  }

  @Roles(ADMIN)
  @Patch(':id/archive')
  @ApiOperation({ summary: 'Soft-delete (archive) a person' })
  archive(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.service.archive(id, user);
  }

  @Roles(ADMIN)
  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore an archived person' })
  restore(@Param('id') id: string) {
    return this.service.restore(id);
  }

  @Roles(ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete (archive) a person' })
  remove(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.service.remove(id, user);
  }
}
