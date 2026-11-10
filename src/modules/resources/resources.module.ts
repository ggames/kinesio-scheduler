import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resource } from './domain/resource.entity';
import { ResourcesController } from './infrastructure/resources.controller';
import { ResourcesService } from './application/resources.service';

@Module({
  imports: [TypeOrmModule.forFeature([Resource])],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [TypeOrmModule, ResourcesService]
})
export class ResourcesModule {}
