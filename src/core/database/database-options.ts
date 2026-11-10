import { DataSourceOptions } from 'typeorm';

export type EnvGetter = (key: string) => string | undefined;

const DEFAULT_DB_PORT = 5432;

/**
 * Builds the PostgreSQL connection options shared by the Nest module and the
 * TypeORM CLI. Keeping a single implementation prevents dev/CLI drift.
 */
export function buildPostgresOptions(getEnv: EnvGetter): DataSourceOptions {
  const host = getEnv('DB_HOST')?.trim() || 'localhost';
  const user = getEnv('DB_USER') ?? '';
  const pass = getEnv('DB_PASS') ?? '';
  const rawPort = Number(getEnv('DB_PORT') || DEFAULT_DB_PORT);
  const port = Number.isFinite(rawPort) ? rawPort : DEFAULT_DB_PORT;
  const database = getEnv('DB_DATABASE') || 'neondb';
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';

  let optionsStr = getEnv('DB_OPTIONS') || '';
  let url = getEnv('DB_URL')?.trim();

  if (!url && !isLocalHost) {
    if (!optionsStr) {
      optionsStr = 'sslmode=require';
    }
    const cleanOptions = optionsStr.startsWith('?') ? optionsStr.slice(1) : optionsStr;
    const encodedUser = encodeURIComponent(user);
    const encodedPass = encodeURIComponent(pass);
    url = `postgres://${encodedUser}:${encodedPass}@${host}:${port}/${database}?${cleanOptions}`;
  }

  const sslEnv = getEnv('DB_SSL');
  const sslEnabled = sslEnv ? sslEnv !== 'false' : !isLocalHost;
  const rejectUnauthorized = getEnv('DB_SSL_REJECT_UNAUTHORIZED') !== 'false';
  const ca = getEnv('DB_SSL_CA');
  const ssl = sslEnabled ? { rejectUnauthorized, ...(ca ? { ca } : {}) } : false;

  const base = {
    type: 'postgres' as const,
    ssl,
    extra: sslEnabled ? { ssl } : {},
    synchronize: false as const,
    logging: getEnv('DB_LOGGING') === 'true',
  };

  return url
    ? { ...base, url }
    : {
        ...base,
        host,
        port,
        username: user,
        password: pass,
        database,
      };
}
