import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './core/database/database.module';
import { AuthModule } from './core/auth/auth.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { PatientsModule } from './modules/patients/patients.module';
import { ProfessionalsModule } from './modules/professionals/professionals.module';
import { HealthInsurancesModule } from './modules/health-insurances/health-insurances.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { AgendaModule } from './modules/agenda/agenda.module';
import { HealthModule } from './health/health.module';
import { TreatmentsModule } from './modules/treatments/treatments.module';
import { MedicalHistoriesModule } from './modules/medical-histories/medical-histories.module';
import { PersonsModule } from './modules/persons/persons.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { MetricsModule } from './core/metrics/metrics.module';
import { RateLimitGuard } from './core/security/rate-limit.guard';
import { DistributedRateLimitService } from './core/security/distributed-rate-limit.service';
import { RequestContextModule } from './core/request-context/request-context.module';
import { SchedulingModule } from './core/scheduling/scheduling.module';
import { RequestContextMiddleware } from './core/request-context/request-context.middleware';
import { AllExceptionsFilter } from './core/http/all-exceptions.filter';
import { validateEnv } from './core/config/env.validation';

@Module({
  imports: [
    RequestContextModule,
    SchedulingModule,
    MetricsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? ['.env.test', '.env'] : '.env',
      validate: validateEnv,
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    AppointmentsModule,
    PatientsModule,
    ProfessionalsModule,
    HealthInsurancesModule,
    ResourcesModule,
    HealthModule,
    AgendaModule,
    TreatmentsModule,
    MedicalHistoriesModule,
    PersonsModule,
    ReportsModule,
    PrivacyModule,
    NotificationsModule,
    AttachmentsModule,
    InvoicesModule,
  ],
  providers: [
    RequestContextMiddleware,
    DistributedRateLimitService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('{*splat}');
  }
}
