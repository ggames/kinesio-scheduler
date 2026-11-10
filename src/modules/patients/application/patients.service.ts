import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Patient } from '../domain/patient.entity';
import { Person } from '../../persons/domain/person.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PaginationQueryDto } from '../../../core/http/dto/pagination-query.dto';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private repo: Repository<Patient>,
    @InjectRepository(Person)
    private personRepo: Repository<Person>,
    private dataSource: DataSource,
  ) {}

  async create(dto: CreatePatientDto, clinicId?: string | null): Promise<Patient> {
    let person: Person | null = null;
    if (dto.personId) {
      person = await this.personRepo.findOne({ where: { id: dto.personId } });
    }
    if (!person && dto.documentId) {
      person = await this.personRepo.findOne({ where: { documentId: dto.documentId } });
    }
    if (!person) {
      person = this.personRepo.create({
        firstName: dto.firstName,
        lastName: dto.lastName,
        documentId: dto.documentId,
        birthDate: dto.birthDate,
        gender: dto.gender,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
      });
      person = await this.personRepo.save(person);
    }

    const entity = this.repo.create({
      person,
      personId: person.id,
      healthInsuranceId: dto.healthInsuranceId,
      obraSocialId: dto.obraSocialId,
      prepagaId: dto.prepagaId,
      clinicId: clinicId ?? dto.clinicId,
      nroAfiliado: dto.nroAfiliado,
    });
    return this.repo.save(entity);
  }

  async findAll(
    query: PaginationQueryDto,
    clinicId?: string | null,
  ): Promise<{ data: Patient[]; meta: any }> {
    const page = query.page ?? DEFAULT_PAGE_CONST;
    const limit = query.limit ?? DEFAULT_LIMIT_CONST;

    const qb = this.repo
      .createQueryBuilder('patient')
      .leftJoinAndSelect('patient.person', 'person')
      .leftJoinAndSelect('patient.medicalHistory', 'medicalHistory')
      .where('patient.archivedAt IS NULL');

    if (query.search) {
      qb.andWhere(
        '(person.firstName ILIKE :search OR person.lastName ILIKE :search OR person.documentId ILIKE :search OR person.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (clinicId) {
      qb.andWhere('patient.clinicId = :clinicId', { clinicId });
    }

    qb.orderBy('person.lastName', 'ASC')
      .addOrderBy('person.firstName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: buildMeta(page, limit, total),
    };
  }

  async findOne(id: string, clinicId?: string | null): Promise<Patient> {
    const found = await this.repo.findOne({
      where: { id, archivedAt: IsNull() },
      relations: { person: true, medicalHistory: true },
    });
    if (!found || (clinicId && found.clinicId !== clinicId)) {
      throw new NotFoundException(`Patient ${id} not found`);
    }
    return found;
  }

  async findMeByUserId(userId: string): Promise<Patient> {
    const person = await this.personRepo.findOne({ where: { userId } });
    if (!person) {
      throw new NotFoundException('Perfil de paciente no encontrado');
    }

    const found = await this.repo.findOne({
      where: { personId: person.id, archivedAt: IsNull() },
      relations: { person: true, medicalHistory: true },
    });
    if (!found) {
      throw new NotFoundException('Perfil de paciente no encontrado');
    }
    return found;
  }

  async findArchived(id: string, clinicId?: string | null): Promise<Patient> {
    const found = await this.repo.findOne({
      where: { id },
      relations: { person: true, medicalHistory: true },
    });
    if (!found || (clinicId && found.clinicId !== clinicId)) {
      throw new NotFoundException(`Patient ${id} not found`);
    }
    return found;
  }

  async update(
    id: string,
    dto: UpdatePatientDto,
    _userId?: string,
    clinicId?: string | null,
  ): Promise<Patient> {
    const patient = await this.findOne(id, clinicId);

    const personUpdates: Partial<Person> = {};
    if (dto.firstName !== undefined) personUpdates.firstName = dto.firstName;
    if (dto.lastName !== undefined) personUpdates.lastName = dto.lastName;
    if (dto.documentId !== undefined) {
      const existing = await this.personRepo.findOne({
        where: { documentId: dto.documentId },
      });
      if (existing && existing.id !== patient.personId) {
        throw new ConflictException(
          `Person with document ID '${dto.documentId}' already exists`,
        );
      }
      personUpdates.documentId = dto.documentId;
    }
    if (dto.birthDate !== undefined) personUpdates.birthDate = dto.birthDate;
    if (dto.gender !== undefined) personUpdates.gender = dto.gender;
    if (dto.phone !== undefined) personUpdates.phone = dto.phone;
    if (dto.email !== undefined) personUpdates.email = dto.email;
    if (dto.address !== undefined) personUpdates.address = dto.address;
    if (dto.emergencyContactName !== undefined)
      personUpdates.emergencyContactName = dto.emergencyContactName;
    if (dto.emergencyContactPhone !== undefined)
      personUpdates.emergencyContactPhone = dto.emergencyContactPhone;

    if (Object.keys(personUpdates).length > 0) {
      await this.personRepo.update(patient.personId, personUpdates);
    }

    const patientUpdates: Partial<Patient> = {};
    if (dto.healthInsuranceId !== undefined)
      patientUpdates.healthInsuranceId = dto.healthInsuranceId;
    if (dto.obraSocialId !== undefined) patientUpdates.obraSocialId = dto.obraSocialId;
    if (dto.prepagaId !== undefined) patientUpdates.prepagaId = dto.prepagaId;
    if (dto.clinicId !== undefined) patientUpdates.clinicId = dto.clinicId;
    if (dto.nroAfiliado !== undefined) patientUpdates.nroAfiliado = dto.nroAfiliado;

    if (Object.keys(patientUpdates).length > 0) {
      await this.repo.update({ id, archivedAt: IsNull() }, patientUpdates);
    }

    return this.findOne(id, clinicId);
  }

  async archive(
    id: string,
    userId?: string,
    clinicId?: string | null,
  ): Promise<Patient> {
    const patient = await this.findOne(id, clinicId);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Patient, { id, archivedAt: IsNull() }, {
        archivedAt: new Date(),
        archivedByUserId: userId ?? null,
      });
      await manager.update(
        Person,
        { id: patient.personId },
        { archivedAt: new Date(), archivedByUserId: userId ?? null },
      );
    });

    return this.findArchived(id, clinicId);
  }

  async restore(
    id: string,
    _userId?: string,
    clinicId?: string | null,
  ): Promise<Patient> {
    const patient = await this.findArchived(id, clinicId);
    if (!patient.archivedAt) {
      throw new BadRequestException(`Patient ${id} is not archived`);
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Patient, { id }, {
        archivedAt: null,
        archivedByUserId: null,
      });
      await manager.update(
        Person,
        { id: patient.personId },
        { archivedAt: null, archivedByUserId: null },
      );
    });

    return this.findOne(id, clinicId);
  }
}

const DEFAULT_PAGE_CONST = 1;
const DEFAULT_LIMIT_CONST = 20;

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
