import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('debe aceptar una configuración de desarrollo válida', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        JWT_SECRET: '0123456789abcdef0123456789abcdef',
        PORT: '3000',
      }),
    ).not.toThrow();
  });

  it('debe rechazar un JWT_SECRET corto', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        JWT_SECRET: 'corto',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('debe exigir base de datos y secreto en producción', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(
      /JWT_SECRET.*DB_URL|DB_URL.*JWT_SECRET/s,
    );
  });

  it('debe exigir MAIL_HOST y MAIL_FROM cuando el mail está habilitado', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_SECRET: '0123456789abcdef0123456789abcdef',
        DB_URL: 'postgres://user:pass@localhost/db',
        MAIL_ENABLED: 'true',
      }),
    ).toThrow(/MAIL_HOST/);
  });

  it('debe aceptar una ventana de cancelación válida', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        JWT_SECRET: '0123456789abcdef0123456789abcdef',
        CANCELLATION_WINDOW_HOURS: '24',
      }),
    ).not.toThrow();
  });

  it('debe rechazar una ventana de cancelación inválida', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        JWT_SECRET: '0123456789abcdef0123456789abcdef',
        CANCELLATION_WINDOW_HOURS: '-1',
      }),
    ).toThrow(/CANCELLATION_WINDOW_HOURS/);
  });

  it('debe rechazar un puerto inválido', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        JWT_SECRET: '0123456789abcdef0123456789abcdef',
        PORT: '99999',
      }),
    ).toThrow(/PORT/);
  });
});
