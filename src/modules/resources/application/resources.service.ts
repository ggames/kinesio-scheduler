import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Resource } from '../domain/resource.entity';
import {
  CreateResourceDto,
  UpdateResourceDto,
} from './dto/create-resource.dto';
import type { PaginationQueryDto } from '../../../core/http/dto/pagination-query.dto';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(Resource)
    private repo: Repository<Resource>,
  ) {}

  async create(dto: CreateResourceDto): Promise<Resource> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<{ data: Resource[]; meta: any }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.repo
      .createQueryBuilder('resource')
      .orderBy('resource.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.search) {
      qb.andWhere('(resource.name ILIKE :search OR resource.type ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(page, limit, total) };
  }

  async findOne(id: string): Promise<Resource> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`Resource #${id} not found`);
    return entity;
  }

  async update(id: string, dto: UpdateResourceDto): Promise<Resource> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    try {
      await this.repo.remove(entity);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException('Resource is in use and cannot be deleted');
      }
      throw error;
    }
  }
}

function buildMeta(page: number, limit: number, total: number): any {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, pageCount, hasNext: page < pageCount, hasPrevious: page > 1 };
}
