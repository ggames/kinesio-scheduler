import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Holiday } from '../../domain/holiday.entity';
import { CreateHolidayDto } from '../dto/create-holiday.dto';
import type { PaginationQueryDto } from '../../../../../core/http/dto/pagination-query.dto';

@Injectable()
export class HolidayService {
  constructor(
    @InjectRepository(Holiday) private readonly repo: Repository<Holiday>,
  ) {}

  async findAll(query?: PaginationQueryDto & { clinicId?: string }): Promise<{ data: Holiday[]; meta: any }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const qb = this.repo
      .createQueryBuilder('holiday')
      .orderBy('holiday.date', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    if (query?.clinicId) {
      qb.andWhere('holiday.clinicId = :clinicId', { clinicId: query.clinicId });
    }
    if (query?.search) {
      qb.andWhere('holiday.name ILIKE :search', { search: `%${query.search}%` });
    }
    const [data, total] = await qb.getManyAndCount();
    const pageCount = Math.max(1, Math.ceil(total / limit));
    return { data, meta: { page, limit, total, pageCount, hasNext: page < pageCount, hasPrevious: page > 1 } };
  }

  async findOne(id: string): Promise<Holiday> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Holiday not found');
    return entity;
  }

  async create(dto: CreateHolidayDto): Promise<Holiday> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async update(id: string, dto: Partial<CreateHolidayDto>): Promise<Holiday> {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
