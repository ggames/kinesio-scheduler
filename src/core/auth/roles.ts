export const ADMIN = 'ADMIN';
export const CLINIC_ADMIN = 'CLINIC_ADMIN';
export const STAFF = 'STAFF';
export const PATIENT = 'PATIENT';
export const PROFESSIONAL = 'PROFESSIONAL';

export interface RoleHolder {
  role?: string;
  roles?: string[];
}

export interface AuthenticatedUser extends RoleHolder {
  userId: string;
  clinicId?: string | null;
  email?: string;
  tokenVersion?: number;
}

/**
 * Unifies the legacy single `role` with the multi-role `roles` array.
 * `PROFESSIONAL` is aliased to `STAFF`: professionals operate as staff.
 */
export function normalizeRoles(user?: RoleHolder | null): string[] {
  const values = new Set<string>();
  for (const value of [user?.role, ...(user?.roles ?? [])]) {
    if (!value) continue;
    const normalized = value.toUpperCase();
    values.add(normalized === PROFESSIONAL ? STAFF : normalized);
  }
  return [...values];
}

export function hasAnyRole(user: RoleHolder | null | undefined, ...roles: string[]): boolean {
  const userRoles = normalizeRoles(user);
  return roles.some((role) => userRoles.includes(role.toUpperCase()));
}

export function isStaff(user: RoleHolder | null | undefined): boolean {
  return hasAnyRole(user, ADMIN, CLINIC_ADMIN, STAFF);
}

/**
 * Primary role exposed to clients, with legacy PROFESSIONAL already aliased.
 */
export function primaryRole(user: RoleHolder | null | undefined): string {
  const roles = normalizeRoles(user);
  if (roles.includes(ADMIN)) return ADMIN;
  if (roles.includes(CLINIC_ADMIN)) return CLINIC_ADMIN;
  if (roles.includes(STAFF)) return STAFF;
  return roles[0] ?? PATIENT;
}
