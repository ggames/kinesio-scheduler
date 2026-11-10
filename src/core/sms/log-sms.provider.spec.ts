import { LogSmsProvider } from './log-sms.provider';

describe('LogSmsProvider', () => {
  const provider = new LogSmsProvider();
  const original = process.env.SMS_ENABLED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.SMS_ENABLED;
    } else {
      process.env.SMS_ENABLED = original;
    }
  });

  it('debe estar deshabilitado por defecto', () => {
    delete process.env.SMS_ENABLED;
    expect(provider.isEnabled()).toBe(false);
  });

  it('debe habilitarse con SMS_ENABLED=true', () => {
    process.env.SMS_ENABLED = 'true';
    expect(provider.isEnabled()).toBe(true);
  });

  it('debe enviar sin lanzar errores cuando está habilitado', async () => {
    process.env.SMS_ENABLED = 'true';
    await expect(
      provider.send({ to: '+5491100000000', text: 'Hola' }),
    ).resolves.toBeUndefined();
  });

  it('debe omitir el envío cuando está deshabilitado', async () => {
    process.env.SMS_ENABLED = 'false';
    await expect(
      provider.send({ to: '+5491100000000', text: 'Hola' }),
    ).resolves.toBeUndefined();
  });
});
