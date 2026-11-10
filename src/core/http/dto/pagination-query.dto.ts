import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt({ message: 'page debe ser un entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt({ message: 'limit debe ser un entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(MAX_LIMIT, { message: `limit no puede exceder ${MAX_LIMIT}` })
  limit?: number;

  @ApiPropertyOptional({ example: 'Juan', description: 'Búsqueda por texto' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pageCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
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
