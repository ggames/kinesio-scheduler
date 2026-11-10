import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestContextModule } from '../request-context/request-context.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { AuditLog } from './domain/audit-log.entity';
import { User } from '../../modules/users/domain/user.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { RetentionTask } from './retention.task';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog, User]),
    RequestContextModule,
    SchedulingModule,
  ],
  controllers: [AuditController],
  providers: [AuditService, RetentionTask],
  exports: [AuditService],
})
export class AuditModule {}
