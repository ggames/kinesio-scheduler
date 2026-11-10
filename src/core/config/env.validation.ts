const MIN_JWT_SECRET_LENGTH = 32;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];
  const nodeEnv = String(config.NODE_ENV ?? 'development');
  const isProduction = nodeEnv === 'production';

  const jwtSecret = String(config.JWT_SECRET ?? '');
  if (jwtSecret && jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(
      `JWT_SECRET debe tener al menos ${MIN_JWT_SECRET_LENGTH} caracteres`,
    );
  }
  if (isProduction && !jwtSecret) {
    errors.push('JWT_SECRET es obligatorio en producción');
  }

  const dbUrl = String(config.DB_URL ?? '').trim();
  const dbHost = String(config.DB_HOST ?? '').trim();
  if (isProduction && !dbUrl && !dbHost) {
    errors.push('DB_URL o DB_HOST es obligatorio en producción');
  }

  if (isProduction && String(config.MAIL_ENABLED).toLowerCase() === 'true') {
    if (!String(config.MAIL_HOST ?? '').trim()) {
      errors.push('MAIL_HOST es obligatorio cuando MAIL_ENABLED=true');
    }
    if (!String(config.MAIL_FROM ?? '').trim()) {
      errors.push('MAIL_FROM es obligatorio cuando MAIL_ENABLED=true');
    }
  }

  const port = Number(config.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    errors.push('PORT debe ser un puerto válido');
  }

  if (config.CANCELLATION_WINDOW_HOURS !== undefined) {
    const hours = Number(config.CANCELLATION_WINDOW_HOURS);
    if (!Number.isFinite(hours) || hours < 0) {
      errors.push('CANCELLATION_WINDOW_HOURS debe ser un número mayor o igual a 0');
    }
  }

  validatePositiveInt(config, errors, 'REMINDER_HOURS');
  validateNonNegativeInt(config, errors, 'AUDIT_RETENTION_DAYS');
  validateNonNegativeInt(config, errors, 'LOGIN_ATTEMPT_RETENTION_DAYS');
  validateNonNegativeInt(config, errors, 'OUTBOX_RETENTION_DAYS');

  const rateLimitStore = String(config.RATE_LIMIT_STORE ?? 'memory');
  if (!['memory', 'postgres'].includes(rateLimitStore)) {
    errors.push('RATE_LIMIT_STORE debe ser "memory" o "postgres"');
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuración de entorno inválida:\n - ${errors.join('\n - ')}`,
    );
  }

  return config;
}

function validatePositiveInt(
  config: Record<string, unknown>,
  errors: string[],
  key: string,
): void {
  if (config[key] === undefined) return;
  const value = Number(config[key]);
  if (!Number.isInteger(value) || value <= 0) {
    errors.push(`${key} debe ser un entero mayor a 0`);
  }
}

function validateNonNegativeInt(
  config: Record<string, unknown>,
  errors: string[],
  key: string,
): void {
  if (config[key] === undefined) return;
  const value = Number(config[key]);
  if (!Number.isInteger(value) || value < 0) {
    errors.push(`${key} debe ser un entero mayor o igual a 0`);
  }
}
