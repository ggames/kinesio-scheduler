import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { buildPostgresOptions } from './database-options';

/**
 * Módulo de Base de Datos exclusivo para PostgreSQL (Neon / Supabase / AWS / Local).
 *
 * Las migraciones se ejecutan de forma explícita (`npm run migration:run`) y
 * nunca con `synchronize`, para evitar cambios de esquema no revisados.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const connection = buildPostgresOptions((key) => configService.get<string>(key));
        const target = configService.get<string>('DB_HOST') || 'DB_URL';

        logger.log(`Conectando a base de datos PostgreSQL (${target})...`);
        logger.log('Sincronización automática deshabilitada; use migraciones.');

        return {
          ...connection,
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: false,
          migrations: [
            join(
              process.cwd(),
              process.env.NODE_ENV === 'production' ? 'dist' : 'src',
              'migrations',
              '*{.ts,.js}',
            ),
          ],
          retryAttempts: 5,
          retryDelay: 3000,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
