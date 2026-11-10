import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { EmailOutbox } from './domain/email-outbox.entity';
import { MailService } from './mail.service';
import { TokenCipher } from './token-cipher';

describe('MailService', () => {
  it('debe encolar una activación con la URL cifrada y sin el token crudo', async () => {
    const configService = {
      get: (jest.fn() as any).mockImplementation((key: string) => {
        if (key === 'APP_URL') return 'https://app.test/';
        return undefined;
      }),
    } as unknown as ConfigService;
    const tokenCipher = {
      encrypt: (jest.fn() as any).mockReturnValue('encrypted-url'),
      decrypt: (jest.fn() as any),
    } as unknown as TokenCipher;
    const service = new MailService(configService, tokenCipher, {} as any);

    let savedEntity: any;
    const manager = {
      create: (jest.fn() as any).mockImplementation((_entity: any, data: any) => ({
        id: 'outbox-1',
        ...data,
      })),
      save: (jest.fn() as any).mockImplementation(async (_entity: any, data: any) => {
        savedEntity = data;
        return data;
      }),
    };

    await service.enqueueActivationEmail(manager as any, {
      to: '  Profesional@Test.com ',
      firstName: 'Carlos',
      token: 'raw-token-123',
    });

    expect(manager.create).toHaveBeenCalledWith(
      EmailOutbox,
      expect.objectContaining({
        to: 'profesional@test.com',
        template: 'activation',
        payload: {
          firstName: 'Carlos',
          encryptedActivationUrl: 'encrypted-url',
        },
      }),
    );
    expect(tokenCipher.encrypt).toHaveBeenCalledWith(
      'https://app.test/activate-account?token=raw-token-123',
    );
    expect(JSON.stringify(savedEntity)).not.toContain('raw-token-123');
  });

  it('filtra el outbox por clínica y bloquea reintentos ajenos', async () => {
    const qb = {
      andWhere: (jest.fn() as any).mockReturnThis(),
      orderBy: (jest.fn() as any).mockReturnThis(),
      skip: (jest.fn() as any).mockReturnThis(),
      take: (jest.fn() as any).mockReturnThis(),
      getManyAndCount: (jest.fn() as any).mockResolvedValue([[], 0]),
    };
    const repository = {
      createQueryBuilder: (jest.fn() as any).mockReturnValue(qb),
      findOne: (jest.fn() as any).mockResolvedValue({
        id: 'outbox-1',
        clinicId: 'clinic-b',
      }),
      save: (jest.fn() as any).mockImplementation(async (data: any) => data),
    };
    const service = new MailService(
      {} as any,
      {} as any,
      repository as any,
    );

    await service.findOutbox({ page: 1, limit: 10, clinicId: 'clinic-a' });
    expect(qb.andWhere).toHaveBeenCalledWith('outbox.clinicId = :clinicId', {
      clinicId: 'clinic-a',
    });

    await expect(service.retryOutbox('outbox-1', 'clinic-a')).rejects.toThrow(
      'Outbox email outbox-1 not found',
    );
  });
});
