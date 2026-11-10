import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../../domain/clinic.entity';
import { CreateClinicDto } from '../dto/create-clinic.dto';
import type { PaginationQueryDto } from '../../../../../core/http/dto/pagination-query.dto';

@Injectable()
export class ClinicService {
  constructor(
    @InjectRepository(Clinic) private readonly repo: Repository<Clinic>,
  ) {}

  async findAll(query?: PaginationQueryDto): Promise<{ data: Clinic[]; meta: any }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const qb = this.repo
      .createQueryBuilder('clinic')
      .orderBy('clinic.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    if (query?.search) {
      qb.andWhere('clinic.name ILIKE :search', { search: `%${query.search}%` });
    }
    const [data, total] = await qb.getManyAndCount();
    const pageCount = Math.max(1, Math.ceil(total / limit));
    return { data, meta: { page, limit, total, pageCount, hasNext: page < pageCount, hasPrevious: page > 1 } };
  }

  async findOne(id: string): Promise<Clinic> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Clinic not found');
    return entity;
  }

  async create(dto: CreateClinicDto): Promise<Clinic> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async update(id: string, dto: Partial<CreateClinicDto>): Promise<Clinic> {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
