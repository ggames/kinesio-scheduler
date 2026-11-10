import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthorizationModule } from '../../core/auth/authorization.module';
import { Invoice } from './domain/invoice.entity';
import { InvoiceItem } from './domain/invoice-item.entity';
import { Payment } from './domain/payment.entity';
import { InvoicesService } from './application/invoices.service';
import { InvoicesController } from './infrastructure/invoices.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Invoice, InvoiceItem, Payment]),
    AuthorizationModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
