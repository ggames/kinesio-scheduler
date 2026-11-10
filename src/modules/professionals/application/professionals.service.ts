import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Professional } from '../domain/professional.entity';
import { Person } from '../../persons/domain/person.entity';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import type { PaginationQueryDto } from '../../../core/http/dto/pagination-query.dto';
import { DoctorScheduleTemplate } from '../../../modules/agenda/doctor-schedule-template/domain/doctor-schedule-template.entity';

@Injectable()
export class ProfessionalsService {
  constructor(
    @InjectRepository(Professional)
    private repo: Repository<Professional>,
    @InjectRepository(Person)
    private personRepo: Repository<Person>,
  ) {}

  async create(dto: CreateProfessionalDto): Promise<Professional> {
    let person: Person | null = null;

    if (dto.personId) {
      person = await this.personRepo.findOne({ where: { id: dto.personId } });
      if (!person) {
        throw new NotFoundException(`Person with id '${dto.personId}' not found`);
      }
    }

    if (!person && dto.documentId) {
      person = await this.personRepo.findOne({ where: { documentId: dto.documentId } });
    }

    if (!person) {
      if (!dto.documentId) {
        throw new BadRequestException('documentId is required when creating a new professional without an existing Person record');
      }
      person = this.personRepo.create({
        firstName: dto.firstName,
        lastName: dto.lastName,
        documentId: dto.documentId,
        email: dto.email,
        phone: dto.phone,
      });
      person = await this.personRepo.save(person);
    }

    const entity = this.repo.create({
      person,
      personId: person.id,
      specialty: dto.specialty,
      licenseNumber: dto.licenseNumber,
    });
    return this.repo.save(entity);
  }

  async findAll(
    query: PaginationQueryDto & { clinicId?: string },
    includeInactive = false,
  ): Promise<{ data: Professional[]; meta: any }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.repo
      .createQueryBuilder('professional')
      .leftJoinAndSelect('professional.person', 'person')
      .orderBy('person.lastName', 'ASC')
      .addOrderBy('person.firstName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (!includeInactive) {
      qb.andWhere('professional.isActive = :isActive', { isActive: true });
    }

    if (query.clinicId) {
      qb.innerJoin(
        DoctorScheduleTemplate,
        'template',
        'template.professionalId = professional.id AND template.clinicId = :clinicId',
        { clinicId: query.clinicId },
      );
      qb.addSelect('DISTINCT professional.id');
    }

    if (query.search) {
      qb.andWhere(
        '(person.firstName ILIKE :search OR person.lastName ILIKE :search OR person.documentId ILIKE :search OR professional.specialty ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: buildMeta(page, limit, total),
    };
  }

  async findOne(id: string): Promise<Professional> {
    const found = await this.repo.findOne({
      where: { id },
      relations: { person: true },
    });
    if (!found) {
      throw new NotFoundException(`Professional ${id} not found`);
    }
    return found;
  }

  async update(
    id: string,
    dto: UpdateProfessionalDto,
  ): Promise<Professional> {
    const professional = await this.findOne(id);

    const personUpdates: Partial<Person> = {};
    if (dto.firstName !== undefined) personUpdates.firstName = dto.firstName;
    if (dto.lastName !== undefined) personUpdates.lastName = dto.lastName;
    if (dto.documentId !== undefined) {
      const existing = await this.personRepo.findOne({
        where: { documentId: dto.documentId },
      });
      if (existing && existing.id !== professional.personId) {
        throw new ConflictException(
          `Person with document ID '${dto.documentId}' already exists`,
        );
      }
      personUpdates.documentId = dto.documentId;
    }
    if (dto.email !== undefined) personUpdates.email = dto.email;
    if (dto.phone !== undefined) personUpdates.phone = dto.phone;

    if (Object.keys(personUpdates).length > 0) {
      await this.personRepo.update(professional.personId, personUpdates);
    }

    const professionalUpdates: Partial<Professional> = {};
    if (dto.specialty !== undefined) professionalUpdates.specialty = dto.specialty;
    if (dto.licenseNumber !== undefined) professionalUpdates.licenseNumber = dto.licenseNumber;
    if (dto.isActive !== undefined) professionalUpdates.isActive = dto.isActive;

    if (dto.isActive === false && !professional.deactivatedAt) {
      professionalUpdates.deactivatedAt = new Date();
    }
    if (dto.isActive === true) {
      professionalUpdates.deactivatedAt = null;
    }

    if (Object.keys(professionalUpdates).length > 0) {
      await this.repo.update({ id }, professionalUpdates);
    }

    return this.findOne(id);
  }

  async deactivate(id: string): Promise<Professional> {
    return this.update(id, { isActive: false });
  }

  async reactivate(id: string): Promise<Professional> {
    return this.update(id, { isActive: true });
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
