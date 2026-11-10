import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { buildPostgresOptions } from './core/database/database-options';

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });

const connection = buildPostgresOptions((key) => process.env[key]);

/**
 * DataSource exclusivo del CLI de TypeORM (migraciones).
 * La aplicación Nest usa DatabaseModule con la misma configuración base.
 */
export const AppDataSource = new DataSource({
  ...connection,
  synchronize: false,
  entities: [join(__dirname, '**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  subscribers: [],
});
