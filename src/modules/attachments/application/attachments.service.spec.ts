import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { AttachmentsService } from './attachments.service';

const user = { userId: 'user-1', roles: ['ADMIN'] } as any;

function buildRepository() {
  return {
    create: (jest.fn() as any).mockImplementation((value: any) => ({ ...value })),
    save: (jest.fn() as any).mockImplementation(async (value: any) => value),
    find: (jest.fn() as any).mockResolvedValue([]),
    findOne: (jest.fn() as any).mockResolvedValue(null),
  };
}

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let repo: ReturnType<typeof buildRepository>;
  let authorization: any;
  let storageDir: string;

  beforeEach(() => {
    storageDir = join(tmpdir(), `attachments-spec-${randomUUID()}`);
    process.env.UPLOAD_DIR = storageDir;
    repo = buildRepository();
    authorization = {
      getPatientClinicId: (jest.fn() as any).mockResolvedValue('clinic-1'),
      getDefaultClinicId: (jest.fn() as any).mockResolvedValue('clinic-1'),
      assertCanReadClinicalRecord: (jest.fn() as any).mockResolvedValue(undefined),
    };
    service = new AttachmentsService(
      repo as any,
      authorization,
      {
        save: (jest.fn() as any).mockImplementation(async (key: string, buffer: Buffer) => {
          await mkdir(storageDir, { recursive: true });
          const fullPath = join(storageDir, key);
          await writeFile(fullPath, buffer);
          return { storageKey: key, storagePath: fullPath };
        }),
      } as any,
      { scan: (jest.fn() as any).mockResolvedValue({ isClean: true }) } as any,
    );
  });

  afterEach(async () => {
    await rm(storageDir, { recursive: true, force: true });
    delete process.env.UPLOAD_DIR;
  });

  it('debe guardar el archivo y registrar el adjunto', async () => {
    const dto = {
      patientId: 'patient-1',
      fileName: 'informe.pdf',
      mimeType: 'application/pdf',
      contentBase64: Buffer.from('contenido').toString('base64'),
    };

    const result = await service.create(dto, user);

    expect(authorization.assertCanReadClinicalRecord).toHaveBeenCalledWith(
      user,
      'patient-1',
    );
    expect(result.sizeBytes).toBe(Buffer.from('contenido').length);
    const stored = await readFile(result.storagePath, 'utf8');
    expect(stored).toBe('contenido');
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'patient-1', fileName: 'informe.pdf' }),
    );
  });

  it('debe sanitizar el nombre del archivo', async () => {
    const result = await service.create(
      {
        patientId: 'patient-1',
        fileName: '../../evil name!.txt',
        mimeType: 'text/plain',
        contentBase64: Buffer.from('x').toString('base64'),
      },
      user,
    );

    expect(result.storagePath).not.toContain('..');
    expect(result.storagePath).toContain('evil_name_.txt');
  });

  it('debe listar adjuntos de un paciente', async () => {
    repo.find.mockResolvedValue([{ id: 'a1' }] as never);

    const result = await service.findAll('patient-1', user);

    expect(result).toEqual([{ id: 'a1' }]);
    expect(repo.find).toHaveBeenCalledWith({
      where: { patientId: 'patient-1', deletedAt: expect.anything() },
      order: { createdAt: 'DESC' },
    });
  });

  it('debe lanzar NotFoundException si el adjunto no existe', async () => {
    await expect(service.findOne('missing', user)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('debe descargar el contenido en base64', async () => {
    const created = await service.create(
      {
        patientId: 'patient-1',
        fileName: 'nota.txt',
        mimeType: 'text/plain',
        contentBase64: Buffer.from('hola').toString('base64'),
      },
      user,
    );
    repo.findOne.mockResolvedValue(created as never);

    const result = await service.download(created.id, user);

    expect(result.fileName).toBe('nota.txt');
    expect(Buffer.from(result.contentBase64, 'base64').toString()).toBe('hola');
  });
});
