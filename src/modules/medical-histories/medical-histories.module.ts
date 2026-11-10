import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalHistory } from './domain/medical-history.entity';
import { ClinicalNote } from './domain/clinical-note.entity';
import { MedicalHistoriesService } from './application/medical-histories.service';
import { ClinicalNotesService } from './application/clinical-notes.service';
import { MedicalHistoriesController } from './infrastructure/medical-histories.controller';
import { ClinicalNotesController } from './infrastructure/clinical-notes.controller';
import { AuthorizationModule } from '../../core/auth/authorization.module';
import { AuditModule } from '../../core/audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MedicalHistory, ClinicalNote]),
    AuthorizationModule,
    AuditModule,
  ],
  controllers: [MedicalHistoriesController, ClinicalNotesController],
  providers: [MedicalHistoriesService, ClinicalNotesService],
  exports: [MedicalHistoriesService, ClinicalNotesService],
})
export class MedicalHistoriesModule {}
