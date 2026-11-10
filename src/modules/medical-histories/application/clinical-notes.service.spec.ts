import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ClinicalNotesService } from './clinical-notes.service';
import { AuditEventType } from '../../../core/audit/domain/audit-log.entity';
import { ClinicalNote } from '../domain/clinical-note.entity';

const professionalUser = {
  userId: 'user-prof',
  role: 'STAFF',
  roles: ['STAFF'],
};
const patientUser = {
  userId: 'user-patient',
  role: 'PATIENT',
  roles: ['PATIENT'],
};

function makeNote(overrides: Partial<ClinicalNote> = {}): ClinicalNote {
  return {
    id: 'note-1',
    patientId: 'patient-1',
    professionalId: 'prof-1',
    appointmentId: null,
    treatmentId: null,
    content: 'Contenido clínico',
    signedAt: null,
    signedByProfessionalId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ClinicalNote;
}

describe('ClinicalNotesService', () => {
  let service: ClinicalNotesService;
  let repo: any;
  let auth: any;
  let audit: any;

  beforeEach(() => {
    repo = {
      findOne: (jest.fn() as any).mockResolvedValue(makeNote()),
      find: (jest.fn() as any).mockResolvedValue([]),
      create: jest.fn().mockImplementation((value: any) => value),
      save: (jest.fn() as any).mockImplementation(async (value: any) => value),
    };
    auth = {
      assertCanWriteClinicalRecord: (jest.fn() as any).mockResolvedValue(
        undefined,
      ),
      assertCanReadClinicalRecord: (jest.fn() as any).mockResolvedValue(
        undefined,
      ),
      canReadClinicalRecord: (jest.fn() as any).mockResolvedValue(true),
      getProfessionalIdForUser: (jest.fn() as any).mockResolvedValue('prof-1'),
      getPatientIdForUser: (jest.fn() as any).mockResolvedValue('patient-1'),
      getPatientClinicId: (jest.fn() as any).mockResolvedValue('clinic-1'),
      getReadablePatientIds: (jest.fn() as any).mockResolvedValue(null),
      getDefaultClinicId: (jest.fn() as any).mockResolvedValue('clinic-1'),
    };
    audit = { record: (jest.fn() as any).mockResolvedValue(undefined) };
    service = new ClinicalNotesService(repo, auth, audit);
  });

  it('firma una nota y la deja inmutable', async () => {
    const signed = await service.sign('note-1', professionalUser);

    expect(signed.signedAt).toBeInstanceOf(Date);
    expect(signed.signedByProfessionalId).toBe('prof-1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: AuditEventType.CLINICAL_NOTE_SIGNED }),
    );
  });

  it('filtra notas por clínica cuando hay scope', async () => {
    await service.findAll(professionalUser, undefined, 'clinic-a');

    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clinicId: 'clinic-a' }),
      }),
    );
  });

  it('rechaza modificar una nota firmada', async () => {
    repo.findOne.mockResolvedValue(
      makeNote({ signedAt: new Date(), signedByProfessionalId: 'prof-1' }),
    );

    await expect(
      service.update('note-1', { content: 'Nuevo contenido' }, professionalUser),
    ).rejects.toThrow(ConflictException);
  });

  it('oculta notas sin firmar a pacientes', async () => {
    await expect(service.findOne('note-1', patientUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('crea una nota con el profesional autenticado', async () => {
    const created = await service.create(
      { patientId: 'patient-1', content: '  Evolución favorable  ' },
      professionalUser,
    );

    expect(created.professionalId).toBe('prof-1');
    expect(created.content).toBe('Evolución favorable');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.CLINICAL_NOTE_CREATED,
      }),
    );
  });

  it('impide firmar una nota a nombre de otro profesional', async () => {
    await expect(
      service.create(
        {
          patientId: 'patient-1',
          professionalId: 'prof-2',
          content: 'Contenido',
        },
        professionalUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
