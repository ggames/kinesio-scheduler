import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from './domain/patient.entity';
import { Person } from '../persons/domain/person.entity';
import { PatientsController } from './infrastructure/patients.controller';
import { PatientsService } from './application/patients.service';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, Person])],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [TypeOrmModule, PatientsService],
})
export class PatientsModule {}
