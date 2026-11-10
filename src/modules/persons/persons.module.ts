import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from './domain/person.entity';
import { PersonsService } from './application/persons.service';
import { PersonsController } from './infrastructure/persons.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Person])],
  controllers: [PersonsController],
  providers: [PersonsService],
  exports: [PersonsService, TypeOrmModule],
})
export class PersonsModule {}
