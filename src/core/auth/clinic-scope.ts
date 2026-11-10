import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ADMIN,
  AuthenticatedUser,
  RoleHolder,
  hasAnyRole,
} from './roles';

/**
 * Resolves the clinic scope for a request.
 *
 * - Global ADMIN may optionally target a clinic via the `X-Clinic-Id` header.
 * - Any other role is locked to its own clinic; requesting another clinic is
 *   forbidden.
 * - Returns null when no scope applies (legacy users without clinic assigned).
 */
export function resolveClinicId(
  user: AuthenticatedUser | RoleHolder | null | undefined,
  requested?: string | null,
): string | null {
  const requestedId =
    typeof requested === 'string' && requested.trim()
      ? requested.trim()
      : undefined;

  if (hasAnyRole(user, ADMIN)) {
    return requestedId ?? (user as AuthenticatedUser)?.clinicId ?? null;
  }

  const own = (user as AuthenticatedUser)?.clinicId ?? null;
  if (requestedId && requestedId !== own) {
    throw new ForbiddenException(
      'No tiene acceso a la clínica solicitada',
    );
  }
  return own;
}

/**
 * Ensures an entity belongs to the user's clinic scope.
 * Uses NotFound to avoid leaking the existence of other clinics' resources.
 */
export function assertClinicAccess(
  user: AuthenticatedUser | RoleHolder | null | undefined,
  clinicId?: string | null,
): void {
  const scope = resolveClinicId(user);
  if (scope && clinicId && clinicId !== scope) {
    throw new NotFoundException('Recurso no encontrado');
  }
}
