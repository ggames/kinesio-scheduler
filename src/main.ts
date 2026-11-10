import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { corsOrigin, getAllowedOrigins } from './core/config/cors';
import { JsonLogger } from './core/logging/json-logger';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: new JsonLogger(process.env.LOG_LEVEL === 'error' ? 'error' : 'log'),
  });

  app.enableShutdownHooks();

  app.use((_req: any, res: any, next: () => void) => {
    res.setHeader('X-API-Version', '1');
    next();
  });

  // ─── Reverse proxy / body limits ──────────────────────────────────────────
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    const value = trustProxy === 'true' ? 1 : Number(trustProxy) || trustProxy;
    app.getHttpAdapter().getInstance().set('trust proxy', value);
  }
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ limit: '1mb', extended: true }));

  // ─── Security headers ─────────────────────────────────────────────────────
  // CSP is disabled to keep Swagger UI working; the remaining helmet headers apply.
  app.use(helmet({ contentSecurityPolicy: false }));

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept',
      'X-Requested-With',
      'X-Request-Id',
      'Idempotency-Key',
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // ─── Global Validation Pipe ────────────────────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // ─── Swagger (disabled in production unless explicitly enabled) ────────────
  const swaggerEnabled =
    process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Kinesiology Scheduler API')
      .setDescription('API for kinesiology clinic scheduling system')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  // ─── Listen ────────────────────────────────────────────────────────────────
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Application running on: http://localhost:${port}`);
  if (swaggerEnabled) {
    logger.log(`Swagger docs at:        http://localhost:${port}/docs`);
  }
  logger.log(`Allowed CORS origins:   ${getAllowedOrigins().join(', ')}`);
}
bootstrap();
