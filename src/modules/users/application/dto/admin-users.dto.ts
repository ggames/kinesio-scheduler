import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '../../domain/user.entity';
import { PaginationQueryDto } from '../../../../core/http/dto/pagination-query.dto';
import { ADMIN, CLINIC_ADMIN, PATIENT, STAFF } from '../../../../core/auth/roles';

export const ASSIGNABLE_ROLES = [ADMIN, CLINIC_ADMIN, STAFF, PATIENT];

export class AdminUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsIn(Object.values(UserStatus))
  status?: UserStatus;

  @ApiPropertyOptional({ enum: ASSIGNABLE_ROLES })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role?: string;
}

export class CreateAdminUserDto {
  @ApiPropertyOptional({ example: 'usuario@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'StrongPass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: ASSIGNABLE_ROLES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(ASSIGNABLE_ROLES, { each: true })
  roles?: string[];

  @ApiPropertyOptional({ enum: ASSIGNABLE_ROLES })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role?: string;

  @ApiPropertyOptional({ description: 'Clinic UUID (required for CLINIC_ADMIN)' })
  @IsOptional()
  @IsUUID()
  clinicId?: string | null;
}

export class UpdateUserAdminDto {
  @ApiPropertyOptional({ example: 'usuario@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: ASSIGNABLE_ROLES })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role?: string;

  @ApiPropertyOptional({ enum: ASSIGNABLE_ROLES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(ASSIGNABLE_ROLES, { each: true })
  roles?: string[];

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsIn(Object.values(UserStatus))
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Clinic UUID' })
  @IsOptional()
  @IsUUID()
  clinicId?: string | null;
}

export class UpdateOwnProfileDto {
  @ApiPropertyOptional({ example: 'usuario@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
