import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Treatment } from './domain/treatment.entity';
import { TreatmentSession } from './domain/treatment-session.entity';
import { TreatmentsController } from './infrastructure/treatments.controller';
import { TreatmentsService } from './application/treatments.service';
import { AuthorizationModule } from '../../core/auth/authorization.module';
import { AuditModule } from '../../core/audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Treatment, TreatmentSession]),
    AuthorizationModule,
    AuditModule,
  ],
  controllers: [TreatmentsController],
  providers: [TreatmentsService],
  exports: [TypeOrmModule, TreatmentsService],
})
export class TreatmentsModule {}
