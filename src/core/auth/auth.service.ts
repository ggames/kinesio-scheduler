import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../modules/users/application/users.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { RegisterProfessionalDto } from './dto/register-professional.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, QueryFailedError, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TokenBlacklist } from '../../modules/users/domain/token-blacklist.entity';
import { PasswordResetToken } from './domain/password-reset-token.entity';
import { User, UserStatus } from '../../modules/users/domain/user.entity';
import { Person, Gender } from '../../modules/persons/domain/person.entity';
import { Patient } from '../../modules/patients/domain/patient.entity';
import { Professional } from '../../modules/professionals/domain/professional.entity';
import { normalizeRoles, primaryRole, PATIENT, STAFF } from './roles';
import { normalizeEmail } from '../utils/email.util';
import { MailService } from '../mail/mail.service';
import { LoginAttemptService } from './login-attempt.service';
import { RefreshTokenService } from './refresh-token.service';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../audit/domain/audit-log.entity';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { hmacSha256, sha256 } from '../utils/hash.util';

const ACTIVATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const BCRYPT_MAX_BYTES = 72;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly dummyPasswordHash = bcrypt.hashSync(
    'dummy-password-not-used',
    10,
  );

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
    private loginAttemptService: LoginAttemptService,
    private refreshTokenService: RefreshTokenService,
    private auditService: AuditService,
    @InjectRepository(TokenBlacklist)
    private blacklistRepo: Repository<TokenBlacklist>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      await bcrypt.compare(pass, this.dummyPasswordHash);
      return null;
    }

    if (user.status !== UserStatus.ACTIVE) {
      await bcrypt.compare(pass, this.dummyPasswordHash);
      return null;
    }

    if (user.passwordHash && (await bcrypt.compare(pass, user.passwordHash))) {
      const { passwordHash: _passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const email = normalizeEmail(loginDto.email);

    try {
      await this.loginAttemptService.assertNotLocked(email);
    } catch (error) {
      await this.auditService.record({
        eventType: AuditEventType.LOGIN_BLOCKED,
        metadata: { emailHash: this.hashEmailForAudit(email) },
      });
      throw error;
    }

    const user = await this.validateUser(email, loginDto.password);
    if (!user) {
      await this.loginAttemptService.recordFailure(email);
      await this.auditService.record({
        eventType: AuditEventType.LOGIN_FAILED,
        metadata: { emailHash: this.hashEmailForAudit(email) },
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }
    await this.loginAttemptService.clearFailures(email);

    const roles = normalizeRoles(user);
    const role = primaryRole(user);
    const payload = {
      email: user.email,
      sub: user.id,
      clinicId: user.clinicId ?? null,
      role,
      roles,
      ver: user.tokenVersion ?? 0,
    };
    const refreshToken = await this.refreshTokenService.issue(user.id);

    await this.auditService.record({
      eventType: AuditEventType.LOGIN_SUCCESS,
      actorUserId: user.id,
    });

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: refreshToken.token,
      user: {
        id: user.id,
        email: user.email,
        role,
        roles,
        status: user.status,
      },
    };
  }

  /**
   * Registro de paciente en una transacción atómica.
   * Crea usuario activo y retorna access_token JWT inmediatamente.
   */
  async registerPatient(dto: RegisterPatientDto) {
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const email = normalizeEmail(dto.email);
        const documentId = dto.documentId.trim();

        const existingUser = await manager.findOne(User, { where: { email } });
        if (existingUser) {
          throw new ConflictException(`El correo '${email}' ya se encuentra registrado`);
        }

        this.assertPasswordFitsBcrypt(dto.password);
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const userRole = PATIENT;

        const user = manager.create(User, {
          email,
          passwordHash,
          role: userRole,
          roles: [userRole],
          status: UserStatus.ACTIVE,
          clinicId: dto.clinicId ?? null,
        });
        const savedUser = await manager.save(User, user);

        let person = await manager.findOne(Person, { where: { documentId } });
        if (!person) {
          person = manager.create(Person, {
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            documentId,
            birthDate: dto.birthDate,
            gender: dto.gender || Gender.NOT_SPECIFIED,
            phone: dto.phone,
            email,
            address: dto.address,
            emergencyContactName: dto.emergencyContactName,
            emergencyContactPhone: dto.emergencyContactPhone,
            user: savedUser,
            userId: savedUser.id,
          });
          person = await manager.save(Person, person);
        } else {
          if (person.userId && person.userId !== savedUser.id) {
            throw new ConflictException(
              `El documento '${documentId}' ya se encuentra registrado`,
            );
          }
          if (!person.userId) {
            person.user = savedUser;
            person.userId = savedUser.id;
            person = await manager.save(Person, person);
          }
        }

        const existingPatient = await manager.findOne(Patient, { where: { personId: person.id } });
        if (existingPatient) {
          throw new ConflictException(`Ya existe un perfil de paciente con el documento '${documentId}'`);
        }

        const patient = manager.create(Patient, {
          person,
          personId: person.id,
          clinic: dto.clinicId ? ({ id: dto.clinicId } as any) : undefined,
          clinicId: dto.clinicId ?? undefined,
        });
        const savedPatient = await manager.save(Patient, patient);

        await this.mailService.enqueueWelcomeEmail(manager, {
          to: savedUser.email,
          firstName: person.firstName,
          clinicId: savedUser.clinicId ?? null,
        });

        const payload = {
          email: savedUser.email,
          sub: savedUser.id,
          clinicId: savedUser.clinicId ?? null,
          role: primaryRole(savedUser),
          roles: [userRole],
          ver: savedUser.tokenVersion ?? 0,
        };
        const access_token = this.jwtService.sign(payload);

        return {
          access_token,
          user: {
            id: savedUser.id,
            email: savedUser.email,
            role: primaryRole(savedUser),
            roles: savedUser.roles,
            status: savedUser.status,
          },
          person,
          patient: savedPatient,
        };
      });

      const refreshToken = await this.refreshTokenService.issue(result.user.id);
      await this.auditService.record({
        eventType: AuditEventType.PATIENT_REGISTERED,
        actorUserId: result.user.id,
        targetUserId: result.user.id,
      });

      return {
        ...result,
        refresh_token: refreshToken.token,
      };
    } catch (error) {
      this.throwIfUniqueViolation(error);
      throw error;
    }
  }

  async registerProfessional(dto: RegisterProfessionalDto, actorUserId?: string) {
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const email = normalizeEmail(dto.email);
        const documentId = dto.documentId.trim();
        const licenseNumber = dto.licenseNumber.trim();

        const existingUser = await manager.findOne(User, { where: { email } });
        if (existingUser) {
          throw new ConflictException(`El correo '${email}' ya se encuentra registrado`);
        }

        if (licenseNumber) {
          const existingLicense = await manager.findOne(Professional, {
            where: { licenseNumber },
          });
          if (existingLicense) {
            throw new ConflictException(
              `La matrícula '${licenseNumber}' ya se encuentra registrada`,
            );
          }
        }

        const rawActivationToken = crypto.randomBytes(32).toString('hex');
        const activationTokenHash = this.hashActivationToken(rawActivationToken);
        const activationTokenExpiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);

        const requestedRoles = normalizeRoles({ roles: dto.roles ?? [] });
        const allowedRoles = [STAFF, PATIENT];
        const invalidRoles = requestedRoles.filter((role) => !allowedRoles.includes(role));
        if (invalidRoles.length > 0) {
          throw new BadRequestException(
            `Roles no permitidos: ${invalidRoles.join(', ')}`,
          );
        }
        const roles = requestedRoles.includes(STAFF)
          ? requestedRoles
          : [STAFF, ...requestedRoles];
        const assignedPrimaryRole = STAFF;

        const user = manager.create(User, {
          email,
          passwordHash: '',
          role: assignedPrimaryRole,
          roles,
          status: UserStatus.PENDING,
          activationTokenHash,
          activationTokenExpiresAt,
        });
        const savedUser = await manager.save(User, user);

        let person = await manager.findOne(Person, { where: { documentId } });
        if (!person) {
          person = manager.create(Person, {
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            documentId,
            email,
            phone: dto.phone,
            user: savedUser,
            userId: savedUser.id,
          });
          person = await manager.save(Person, person);
        } else {
          if (person.userId && person.userId !== savedUser.id) {
            throw new ConflictException(
              `El documento '${documentId}' ya se encuentra registrado`,
            );
          }
          if (!person.userId) {
            person.user = savedUser;
            person.userId = savedUser.id;
            person = await manager.save(Person, person);
          }
        }

        const existingProf = await manager.findOne(Professional, { where: { personId: person.id } });
        if (existingProf) {
          throw new ConflictException(
            `Ya existe un profesional con el documento '${documentId}'`,
          );
        }

        const professional = manager.create(Professional, {
          person,
          personId: person.id,
          specialty: dto.specialty,
          licenseNumber,
        });
        const savedProfessional = await manager.save(Professional, professional);

        await this.mailService.enqueueActivationEmail(manager, {
          to: savedUser.email,
          firstName: person.firstName,
          token: rawActivationToken,
          clinicId: savedUser.clinicId ?? null,
        });

        const baseUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
        const activationLink = `${baseUrl}/activate-account?token=${rawActivationToken}`;
        const exposeActivationLink = this.isDevelopment();

        if (exposeActivationLink) {
          this.logger.log(`Enlace de activación (desarrollo): ${activationLink}`);
        }

        const response: Record<string, unknown> = {
          message: 'Profesional registrado con estado PENDING. Enlace de activación enviado.',
          user: {
            id: savedUser.id,
            email: savedUser.email,
            role: primaryRole(savedUser),
            roles: savedUser.roles,
            status: savedUser.status,
            activationTokenExpiresAt: savedUser.activationTokenExpiresAt,
          },
          person,
          professional: savedProfessional,
        };

        if (exposeActivationLink) {
          response.activationToken = rawActivationToken;
          response.activationLink = activationLink;
        }

        return response;
      });

      await this.auditService.record({
        eventType: AuditEventType.PROFESSIONAL_REGISTERED,
        actorUserId: actorUserId ?? null,
        targetUserId: (result.user as { id: string }).id,
      });

      return result;
    } catch (error) {
      this.throwIfUniqueViolation(error);
      throw error;
    }
  }

  async activateAccount(dto: ActivateAccountDto) {
    const result = await this.dataSource.transaction(async (manager) => {
      const activationTokenHash = this.hashActivationToken(dto.token);
      const user = await manager.findOne(User, {
        where: { activationTokenHash, status: UserStatus.PENDING },
      });

      if (!user) {
        throw new BadRequestException('Token de activación inválido o ya utilizado');
      }

      if (user.activationTokenExpiresAt && new Date(user.activationTokenExpiresAt) < new Date()) {
        throw new BadRequestException('El token de activación ha expirado (24h de validez)');
      }

      this.assertPasswordFitsBcrypt(dto.password);
      const passwordHash = await bcrypt.hash(dto.password, 10);

      user.passwordHash = passwordHash;
      user.status = UserStatus.ACTIVE;
      user.activationTokenHash = null;
      user.activationTokenExpiresAt = null;

      const updatedUser = await manager.save(User, user);

      const payload = {
        email: updatedUser.email,
        sub: updatedUser.id,
        clinicId: updatedUser.clinicId ?? null,
        role: primaryRole(updatedUser),
        roles: normalizeRoles(updatedUser),
        ver: updatedUser.tokenVersion ?? 0,
      };
      const access_token = this.jwtService.sign(payload);

      return {
        message: 'Cuenta activada exitosamente.',
        access_token,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: primaryRole(updatedUser),
          roles: normalizeRoles(updatedUser),
          status: updatedUser.status,
        },
      };
    });

    const refreshToken = await this.refreshTokenService.issue(result.user.id);
    await this.auditService.record({
      eventType: AuditEventType.ACCOUNT_ACTIVATED,
      actorUserId: result.user.id,
      targetUserId: result.user.id,
    });

    return {
      ...result,
      refresh_token: refreshToken.token,
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const rotated = await this.refreshTokenService.rotate(dto.refresh_token);
    const payload = {
      email: rotated.user.email,
      sub: rotated.user.id,
      clinicId: rotated.user.clinicId ?? null,
      role: primaryRole(rotated.user),
      roles: normalizeRoles(rotated.user),
      ver: rotated.user.tokenVersion ?? 0,
    };

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: rotated.token,
    };
  }

  async logout(token: string, refreshToken?: string, userId?: string) {
    const decoded: any = this.jwtService.decode(token);
    if (decoded && decoded.exp) {
      await this.blacklistRepo.save({
        token,
        expiresAt: new Date(decoded.exp * 1000),
      });
    }

    if (refreshToken) {
      await this.refreshTokenService.revoke(refreshToken);
    }

    await this.auditService.record({
      eventType: AuditEventType.LOGOUT,
      actorUserId: userId ?? decoded?.sub ?? null,
    });
  }

  async logoutAll(userId: string) {
    const userRepo = this.dataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await userRepo.save(user);
    await this.refreshTokenService.revokeAllForUser(userId);
    await this.auditService.record({
      eventType: AuditEventType.LOGOUT_ALL,
      actorUserId: userId,
      targetUserId: userId,
    });

    return { message: 'Todas las sesiones fueron cerradas.' };
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const found = await this.blacklistRepo.findOne({ where: { token } });
    return !!found;
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredTokens(): Promise<void> {
    await this.blacklistRepo.delete({ expiresAt: LessThan(new Date()) });
  }

  async getProfile(userId: string) {
    const userRepo = this.dataSource.getRepository(User);
    const personRepo = this.dataSource.getRepository(Person);
    const patientRepo = this.dataSource.getRepository(Patient);

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const professionalRepo = this.dataSource.getRepository(Professional);
    const person = await personRepo.findOne({ where: { userId } });
    let patient: Patient | null = null;
    let professional: Professional | null = null;
    if (person) {
      patient = await patientRepo.findOne({
        where: { personId: person.id },
        relations: { obraSocial: true, prepaga: true, healthInsurance: true },
      });
      professional = await professionalRepo.findOne({ where: { personId: person.id } });
    }

    return {
      id: patient?.id || user.id,
      userId: user.id,
      personId: person?.id,
      patientId: patient?.id,
      professionalId: professional?.id,
      email: user.email,
      firstName: person?.firstName || '',
      lastName: person?.lastName || '',
      documentId: person?.documentId || '',
      phone: person?.phone || '',
      obraSocial: patient?.obraSocial?.name || patient?.healthInsurance?.name || '',
      nroAfiliado: patient?.nroAfiliado || '',
      role: primaryRole(user),
      roles: normalizeRoles(user),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const personRepo = this.dataSource.getRepository(Person);
    const patientRepo = this.dataSource.getRepository(Patient);
    let person = await personRepo.findOne({ where: { userId } });
    if (person) {
      if (dto.firstName) person.firstName = dto.firstName;
      if (dto.lastName) person.lastName = dto.lastName;
      if (dto.phone) person.phone = dto.phone;
      await personRepo.save(person);

      // Update patient profile fields
      const patient = await patientRepo.findOne({ where: { personId: person.id } });
      if (patient) {
        const patientUpdates: Partial<Patient> = {};
        if (dto.healthInsuranceId !== undefined)
          patientUpdates.healthInsuranceId = dto.healthInsuranceId;
        if (dto.nroAfiliado !== undefined)
          patientUpdates.nroAfiliado = dto.nroAfiliado;
        if (Object.keys(patientUpdates).length > 0) {
          await patientRepo.update({ id: patient.id }, patientUpdates);
        }
      }
    }
    return this.getProfile(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const userRepo = this.dataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
    }

    this.assertPasswordFitsBcrypt(dto.newPassword);
    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await userRepo.save(user);
    await this.refreshTokenService.revokeAllForUser(userId);
    await this.auditService.record({
      eventType: AuditEventType.PASSWORD_CHANGED,
      actorUserId: userId,
      targetUserId: userId,
    });

    return { message: 'Contraseña actualizada exitosamente' };
  }

  private hashActivationToken(token: string): string {
    return sha256(token);
  }

  private hashEmailForAudit(email: string): string {
    const secret =
      this.configService.get<string>('AUDIT_HASH_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'audit-secret';
    return hmacSha256(normalizeEmail(email), secret);
  }

  private assertPasswordFitsBcrypt(password: string): void {
    if (Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_BYTES) {
      throw new BadRequestException(
        `La contraseña no puede superar los ${BCRYPT_MAX_BYTES} bytes`,
      );
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user || user.status !== UserStatus.ACTIVE) {
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const person = await this.dataSource
      .getRepository(Person)
      .findOne({ where: { userId: user.id } });

    await this.dataSource.transaction(async (manager) => {
      await manager.save(PasswordResetToken, {
        userId: user.id,
        tokenHash,
        expiresAt,
        used: false,
      });

      await this.mailService.enqueuePasswordResetEmail(manager, {
        to: normalizedEmail,
        firstName: person?.firstName ?? '',
        token,
        clinicId: user.clinicId ?? null,
      });
    });

    await this.auditService.record({
      eventType: AuditEventType.PASSWORD_RESET_REQUEST,
      actorUserId: user.id,
      targetUserId: user.id,
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const tokenHash = sha256(token);
    const tokenEntity = await this.dataSource
      .getRepository(PasswordResetToken)
      .findOne({ where: { tokenHash } });

    if (
      !tokenEntity ||
      tokenEntity.used ||
      tokenEntity.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Token inválido o expirado');
    }

    this.assertPasswordFitsBcrypt(password);
    const passwordHash = await bcrypt.hash(password, 10);

    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: tokenEntity.userId },
      });
      if (!user) {
        throw new BadRequestException('Token inválido o expirado');
      }

      user.passwordHash = passwordHash;
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      user.activationTokenHash = null;
      user.activationTokenExpiresAt = null;
      await manager.save(User, user);

      tokenEntity.used = true;
      await manager.save(PasswordResetToken, tokenEntity);
    });

    await this.refreshTokenService.revokeAllForUser(tokenEntity.userId);
    await this.auditService.record({
      eventType: AuditEventType.PASSWORD_RESET,
      actorUserId: tokenEntity.userId,
      targetUserId: tokenEntity.userId,
    });
  }

  private isDevelopment(): boolean {
    return this.configService.get<string>('NODE_ENV') !== 'production';
  }

  private throwIfUniqueViolation(error: unknown): void {
    if (
      error instanceof QueryFailedError &&
      (error as any).driverError?.code === '23505'
    ) {
      throw new ConflictException(
        'El email, documento o matrícula ya se encuentra registrado',
      );
    }
  }
}
