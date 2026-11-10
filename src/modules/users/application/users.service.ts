import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User, UserStatus } from '../domain/user.entity';
import * as bcrypt from 'bcrypt';
import { normalizeEmail } from '../../../core/utils/email.util';
import { AuditService } from '../../../core/audit/audit.service';
import { AuditEventType } from '../../../core/audit/domain/audit-log.entity';
import { normalizeRoles, primaryRole } from '../../../core/auth/roles';
import {
  AdminUsersQueryDto,
  CreateAdminUserDto,
  UpdateUserAdminDto,
} from './dto/admin-users.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    if (!email) return null;
    const normalizedEmail = normalizeEmail(email);
    return this.userRepository.findOne({ where: { email: normalizedEmail } });
  }

  async findById(id: string): Promise<User | null> {
    if (!id) return null;
    return this.userRepository.findOne({ where: { id } });
  }

  async create(email: string, passwordPlain: string, role = 'PATIENT'): Promise<User> {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);
    const user = this.userRepository.create({
      email: normalizeEmail(email),
      passwordHash,
      role,
      roles: [role],
    });
    return this.userRepository.save(user);
  }

  async createAdmin(dto: CreateAdminUserDto, actorUserId?: string): Promise<Partial<User>> {
    const normalized = normalizeEmail(dto.email);
    const existing = await this.userRepository.findOne({ where: { email: normalized } });
    if (existing) throw new ConflictException(`Email '${dto.email}' already registered`);
    const roles = normalizeRoles(dto.roles?.length ? { roles: dto.roles } : { role: dto.role ?? 'STAFF' });
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);
    const user = this.userRepository.create({
      email: normalized,
      passwordHash,
      role: primaryRole({ roles }),
      roles,
      status: UserStatus.ACTIVE,
      clinicId: dto.clinicId ?? null,
    });
    const saved = await this.userRepository.save(user);
    await this.auditService.record({
      eventType: AuditEventType.USER_UPDATED,
      actorUserId: actorUserId ?? null,
      targetUserId: saved.id,
      metadata: { created: true, roles: saved.roles },
    });
    return this.findAdminOne(saved.id);
  }

  async findAll(query: AdminUsersQueryDto): Promise<{
    data: Partial<User>[];
    meta: any;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.person', 'person')
      .select([
        'user.id',
        'user.email',
        'user.role',
        'user.roles',
        'user.status',
        'user.tokenVersion',
        'user.createdAt',
        'person.id',
        'person.firstName',
        'person.lastName',
        'person.documentId',
        'person.email',
      ])
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }
    if (query.role) {
      qb.andWhere(
        '(user.role = :role OR user.roles LIKE :roleLike)',
        { role: query.role, roleLike: `%${query.role}%` },
      );
    }
    if (query.search) {
      qb.andWhere(
        '(user.email ILIKE :search OR person.firstName ILIKE :search OR person.lastName ILIKE :search OR person.documentId ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data: data as Partial<User>[], meta: buildMeta(page, limit, total) };
  }

  async findAdminOne(id: string): Promise<Partial<User>> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.person', 'person')
      .select([
        'user.id',
        'user.email',
        'user.role',
        'user.roles',
        'user.status',
        'user.tokenVersion',
        'user.createdAt',
        'person.id',
        'person.firstName',
        'person.lastName',
        'person.documentId',
        'person.email',
      ])
      .where('user.id = :id', { id })
      .getOne();

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user as Partial<User>;
  }

  async updateAdmin(
    id: string,
    dto: UpdateUserAdminDto,
    actorUserId?: string,
  ): Promise<Partial<User>> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    let changed = false;
    if (dto.email && normalizeEmail(dto.email) !== user.email) {
      const normalized = normalizeEmail(dto.email);
      const existing = await this.userRepository.findOne({
        where: { email: normalized },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Email '${dto.email}' already registered`);
      }
      user.email = normalized;
      changed = true;
    }

    if (dto.roles) {
      const normalized = normalizeRoles({ roles: dto.roles });
      user.roles = normalized;
      user.role = primaryRole({ roles: normalized });
      changed = true;
    } else if (dto.role) {
      const normalized = normalizeRoles({ role: dto.role });
      user.roles = normalized;
      user.role = primaryRole({ roles: normalized });
      changed = true;
    }

    if (dto.clinicId !== undefined && dto.clinicId !== user.clinicId) {
      user.clinicId = dto.clinicId;
      changed = true;
    }

    if (dto.status && dto.status !== user.status) {
      user.status = dto.status;
      changed = true;
      if (dto.status !== UserStatus.ACTIVE) {
        user.tokenVersion = (user.tokenVersion ?? 0) + 1;
        await this.dataSource
          .createQueryBuilder()
          .update('refresh_tokens')
          .set({ revokedAt: () => 'now()' })
          .where('"userId" = :id AND "revokedAt" IS NULL', { id })
          .execute();
      }
    }

    if (changed) {
      await this.userRepository.save(user);
      await this.auditService.record({
        eventType: AuditEventType.USER_UPDATED,
        actorUserId: actorUserId ?? null,
        targetUserId: id,
        metadata: {
          fields: Object.keys(dto),
          status: user.status,
          roles: user.roles,
        },
      });
    }

    return this.findAdminOne(id);
  }

  async revokeSessions(id: string, actorUserId?: string): Promise<{ revoked: number }> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await this.userRepository.save(user);

    const result = await this.dataSource
      .createQueryBuilder()
      .update('refresh_tokens')
      .set({ revokedAt: () => 'now()' })
      .where('"userId" = :id AND "revokedAt" IS NULL', { id })
      .execute();

    await this.auditService.record({
      eventType: AuditEventType.USER_SESSIONS_REVOKED,
      actorUserId: actorUserId ?? null,
      targetUserId: id,
      metadata: { revoked: result.affected ?? 0 },
    });

    return { revoked: result.affected ?? 0 };
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
