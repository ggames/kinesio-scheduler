import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ResourcesService } from '../application/resources.service';
import {
  CreateResourceDto,
  UpdateResourceDto,
} from '../application/dto/create-resource.dto';
import { PaginationQueryDto } from '../../../core/http/dto/pagination-query.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { ADMIN, CLINIC_ADMIN, STAFF } from '../../../core/auth/roles';

@ApiTags('Resources')
@ApiBearerAuth()
@Controller('resources')
export class ResourcesController {
  constructor(private readonly service: ResourcesService) {}

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Post()
  @ApiOperation({ summary: 'Create a new resource' })
  @ApiBody({ type: CreateResourceDto })
  create(@Body() dto: CreateResourceDto) {
    return this.service.create(dto);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Get()
  @ApiOperation({ summary: 'List resources (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Get(':id')
  @ApiOperation({ summary: 'Get resource by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a resource' })
  @ApiBody({ type: UpdateResourceDto })
  update(@Param('id') id: string, @Body() dto: UpdateResourceDto) {
    return this.service.update(id, dto);
  }

  @Roles(ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a resource if unused' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
