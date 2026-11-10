import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorador para marcar rutas públicas que no requieren autenticación JWT.
 * Ejemplo: @Public()
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
