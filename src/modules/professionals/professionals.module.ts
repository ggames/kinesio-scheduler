import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Professional } from './domain/professional.entity';
import { Person } from '../persons/domain/person.entity';
import { ProfessionalsController } from './infrastructure/professionals.controller';
import { ProfessionalsService } from './application/professionals.service';

@Module({
  imports: [TypeOrmModule.forFeature([Professional, Person])],
  controllers: [ProfessionalsController],
  providers: [ProfessionalsService],
  exports: [TypeOrmModule, ProfessionalsService],
})
export class ProfessionalsModule {}
