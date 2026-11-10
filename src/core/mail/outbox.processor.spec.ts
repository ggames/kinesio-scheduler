import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { OutboxProcessor } from './outbox.processor';
import { TokenCipher } from './token-cipher';

function buildProcessor(options: { sendFails?: boolean } = {}) {
  const email = {
    id: 'outbox-1',
    to: 'profesional@test.com',
    template: 'activation',
    payload: {
      firstName: 'Carlos',
      encryptedActivationUrl: 'encrypted-url',
    },
    attempts: 0,
  };

  const dataSource = {
    query: (jest.fn() as any).mockImplementation(async (sql: string) => {
      if (sql.includes('RETURNING "id"')) return [email];
      return undefined;
    }),
  };
  const mailProvider = {
    isEnabled: () => true,
    send: (jest.fn() as any).mockImplementation(async () => {
      if (options.sendFails) throw new Error('SMTP down');
    }),
  };
  const tokenCipher = {
    decrypt: (jest.fn() as any).mockReturnValue(
      'https://app.test/activate-account?token=raw',
    ),
  };
  const configService = {
    get: (jest.fn() as any).mockReturnValue('5'),
  };

  return {
    processor: new OutboxProcessor(
      dataSource as unknown as DataSource,
      mailProvider as any,
      tokenCipher as unknown as TokenCipher,
      configService as unknown as ConfigService,
    ),
    dataSource,
    mailProvider,
    tokenCipher,
  };
}

describe('OutboxProcessor', () => {
  it('debe enviar el email y marcar la fila como SENT', async () => {
    const { processor, dataSource, mailProvider } = buildProcessor();

    await processor.processPending();

    expect(mailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'profesional@test.com',
        subject: expect.stringContaining('Activá'),
      }),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('"status" = $1'),
      ['SENT', 'outbox-1'],
    );
  });

  it('debe dejar el email pendiente y programar reintento si falla el envío', async () => {
    const { processor, dataSource } = buildProcessor({ sendFails: true });

    await processor.processPending();

    const failedUpdate = dataSource.query.mock.calls.find((call: any[]) =>
      call[0].includes('"attempts" = $2'),
    );

    expect(failedUpdate).toBeDefined();
    expect(failedUpdate[1][0]).toBe('PENDING');
    expect(failedUpdate[1][1]).toBe(1);
  });

  it('no debe procesar si el proveedor está deshabilitado', async () => {
    const { processor, dataSource, mailProvider } = buildProcessor();
    mailProvider.isEnabled = () => false;

    await processor.processPending();

    expect(mailProvider.send).not.toHaveBeenCalled();
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});
