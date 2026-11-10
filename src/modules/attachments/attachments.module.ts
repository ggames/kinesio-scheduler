import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '../../core/auth/authorization.module';
import { ClinicalAttachment } from './domain/clinical-attachment.entity';
import { AttachmentsService } from './application/attachments.service';
import { AttachmentsController } from './infrastructure/attachments.controller';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { NoopAntivirusScanner } from './security/antivirus-scanner.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClinicalAttachment]),
    AuthorizationModule,
  ],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    LocalStorageProvider,
    NoopAntivirusScanner,
  ],
  exports: [AttachmentsService, LocalStorageProvider],
})
export class AttachmentsModule {}
