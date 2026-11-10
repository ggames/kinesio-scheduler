import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { PrivacyService } from './application/privacy.service';
import { PrivacyController } from './infrastructure/privacy.controller';

@Module({
  imports: [AuditModule],
  controllers: [PrivacyController],
  providers: [PrivacyService],
})
export class PrivacyModule {}
