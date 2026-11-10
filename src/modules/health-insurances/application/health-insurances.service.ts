import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { HealthInsurance } from '../domain/health-insurance.entity';
import {
  CreateHealthInsuranceDto,
  UpdateHealthInsuranceDto,
} from './dto/create-health-insurance.dto';
import type { PaginationQueryDto } from '../../../core/http/dto/pagination-query.dto';

@Injectable()
export class HealthInsurancesService {
  constructor(
    @InjectRepository(HealthInsurance)
    private repo: Repository<HealthInsurance>,
  ) {}

  async create(dto: CreateHealthInsuranceDto): Promise<HealthInsurance> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<{ data: HealthInsurance[]; meta: any }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.repo
      .createQueryBuilder('healthInsurance')
      .orderBy('healthInsurance.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.search) {
      qb.andWhere('healthInsurance.name ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(page, limit, total) };
  }

  async findOne(id: string): Promise<HealthInsurance> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`HealthInsurance #${id} not found`);
    return entity;
  }

  async update(
    id: string,
    dto: UpdateHealthInsuranceDto,
  ): Promise<HealthInsurance> {
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
        throw new ConflictException(
          'Health insurance is in use and cannot be deleted',
        );
      }
      throw error;
    }
  }
}

function buildMeta(page: number, limit: number, total: number): any {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, pageCount, hasNext: page < pageCount, hasPrevious: page > 1 };
}
