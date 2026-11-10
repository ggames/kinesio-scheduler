import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Appointment } from '../appointments/domain/appointment.entity';
import { TimeSlot } from '../agenda/time-slot/domain/time-slot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Appointment, TimeSlot])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
