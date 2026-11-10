import { hasAnyRole, isStaff, normalizeRoles, ADMIN, STAFF, PATIENT } from './roles';

describe('roles', () => {
  it('normaliza el rol primario y el array de roles sin duplicados', () => {
    expect(normalizeRoles({ role: 'STAFF', roles: ['STAFF', 'PATIENT'] })).toEqual([
      STAFF,
      PATIENT,
    ]);
  });

  it('alias PROFESSIONAL a STAFF', () => {
    expect(normalizeRoles({ role: 'PROFESSIONAL' })).toEqual([STAFF]);
    expect(isStaff({ role: 'PROFESSIONAL' })).toBe(true);
  });

  it('permite múltiples roles para un STAFF que también es PATIENT', () => {
    const user = { role: 'STAFF', roles: ['STAFF', 'PATIENT'] };
    expect(hasAnyRole(user, ADMIN)).toBe(false);
    expect(hasAnyRole(user, STAFF)).toBe(true);
    expect(hasAnyRole(user, PATIENT)).toBe(true);
  });

  it('rechaza usuarios sin roles', () => {
    expect(hasAnyRole(undefined, ADMIN)).toBe(false);
    expect(isStaff({})).toBe(false);
  });
});
