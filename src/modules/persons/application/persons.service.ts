import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Person } from '../domain/person.entity';
import { CreatePersonDto, UpdatePersonDto } from './dto/create-person.dto';
import type { PaginationQueryDto } from '../../../core/http/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../../../core/auth/roles';

@Injectable()
export class PersonsService {
  constructor(
    @InjectRepository(Person)
    private readonly repo: Repository<Person>,
  ) {}

  async create(dto: CreatePersonDto): Promise<Person> {
    const existing = await this.repo.findOne({ where: { documentId: dto.documentId } });
    if (existing) {
      throw new ConflictException(`Person with document ID '${dto.documentId}' already exists`);
    }
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<{ data: Person[]; meta: any }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.repo
      .createQueryBuilder('person')
      .leftJoinAndSelect('person.patient', 'patient')
      .leftJoinAndSelect('person.professional', 'professional')
      .where('person.archivedAt IS NULL')
      .orderBy('person.lastName', 'ASC')
      .addOrderBy('person.firstName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.search) {
      qb.andWhere(
        '(person.firstName ILIKE :search OR person.lastName ILIKE :search OR person.documentId ILIKE :search OR person.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(page, limit, total) };
  }

  async findOne(id: string): Promise<Person> {
    const found = await this.repo.findOne({
      where: { id },
      relations: { patient: true, professional: true, user: true },
    });
    if (!found) {
      throw new NotFoundException(`Person ${id} not found`);
    }
    return found;
  }

  async findActive(id: string): Promise<Person> {
    const found = await this.repo.findOne({
      where: { id, archivedAt: IsNull() },
      relations: { patient: true, professional: true, user: true },
    });
    if (!found) {
      throw new NotFoundException(`Person ${id} not found`);
    }
    return found;
  }

  async findByDocumentId(documentId: string): Promise<Person | null> {
    return this.repo.findOne({
      where: { documentId },
      relations: { patient: true, professional: true, user: true },
    });
  }

  async update(id: string, dto: UpdatePersonDto): Promise<Person> {
    const found = await this.findActive(id);

    if (dto.documentId && dto.documentId !== found.documentId) {
      const existing = await this.repo.findOne({
        where: { documentId: dto.documentId },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Person with document ID '${dto.documentId}' already exists`,
        );
      }
    }

    Object.assign(found, dto);
    return this.repo.save(found);
  }

  async archive(id: string, user?: AuthenticatedUser | null): Promise<Person> {
    const found = await this.findActive(id);
    found.archivedAt = new Date();
    found.archivedByUserId = user?.userId ?? null;
    return this.repo.save(found);
  }

  async restore(id: string): Promise<Person> {
    const found = await this.findOne(id);
    if (!found.archivedAt) {
      throw new BadRequestException(`Person ${id} is not archived`);
    }
    found.archivedAt = null;
    found.archivedByUserId = null;
    return this.repo.save(found);
  }

  async remove(id: string, user?: AuthenticatedUser | null): Promise<Person> {
    return this.archive(id, user);
  }
}

function buildMeta(page: number, limit: number, total: number): any {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    pageCount,
    hasNext: page < pageCount,
    hasPrevious: page > 1,
  };
}
