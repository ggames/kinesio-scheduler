import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { assertClinicAccess, resolveClinicId } from './clinic-scope';

const clinicUser = {
  userId: 'u1',
  role: 'CLINIC_ADMIN',
  roles: ['CLINIC_ADMIN'],
  clinicId: 'clinic-a',
} as any;

const adminUser = {
  userId: 'admin',
  role: 'ADMIN',
  roles: ['ADMIN'],
  clinicId: null,
} as any;

describe('clinic-scope', () => {
  describe('resolveClinicId', () => {
    it('devuelve la clínica propia para usuarios de clínica', () => {
      expect(resolveClinicId(clinicUser)).toBe('clinic-a');
    });

    it('permite a CLINIC_ADMIN solicitar su propia clínica', () => {
      expect(resolveClinicId(clinicUser, 'clinic-a')).toBe('clinic-a');
    });

    it('prohíbe a usuarios de clínica solicitar otra clínica', () => {
      expect(() => resolveClinicId(clinicUser, 'clinic-b')).toThrow(
        ForbiddenException,
      );
    });

    it('permite a ADMIN global elegir cualquier clínica', () => {
      expect(resolveClinicId(adminUser, 'clinic-b')).toBe('clinic-b');
    });

    it('devuelve null para ADMIN global sin header', () => {
      expect(resolveClinicId(adminUser)).toBeNull();
    });
  });

  describe('assertClinicAccess', () => {
    it('permite acceder a recursos de la propia clínica', () => {
      expect(() => assertClinicAccess(clinicUser, 'clinic-a')).not.toThrow();
    });

    it('oculta recursos de otra clínica', () => {
      expect(() => assertClinicAccess(clinicUser, 'clinic-b')).toThrow(
        NotFoundException,
      );
    });

    it('no restringe a ADMIN global', () => {
      expect(() => assertClinicAccess(adminUser, 'clinic-b')).not.toThrow();
    });
  });
});
