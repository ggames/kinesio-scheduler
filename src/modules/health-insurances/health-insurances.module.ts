import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthInsurance } from './domain/health-insurance.entity';
import { HealthInsurancesController } from './infrastructure/health-insurances.controller';
import { HealthInsurancesService } from './application/health-insurances.service';

@Module({
  imports: [TypeOrmModule.forFeature([HealthInsurance])],
  controllers: [HealthInsurancesController],
  providers: [HealthInsurancesService],
  exports: [TypeOrmModule, HealthInsurancesService]
})
export class HealthInsurancesModule {}
