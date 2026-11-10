import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvoicesService } from '../application/invoices.service';
import { CreateInvoiceDto } from '../application/dto/create-invoice.dto';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { ADMIN, CLINIC_ADMIN } from '../../../core/auth/roles';
import { ClinicScope } from '../../../core/auth/decorators/clinic-scope.decorator';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Roles(ADMIN, CLINIC_ADMIN)
  @Post()
  @ApiOperation({ summary: 'Crear una factura (requiere ENABLE_INVOICING=true)' })
  create(
    @Body() dto: CreateInvoiceDto,
    @Req() _req: any,
  ) {
    return this.service.create(dto, _req.user);
  }

  @Roles(ADMIN, CLINIC_ADMIN)
  @Get()
  @ApiOperation({ summary: 'Listar facturas (filtradas por clínica si hay scope)' })
  findAll(
    @ClinicScope() clinicId: string | null,
    @Req() _req: any,
  ) {
    return this.service.findAll(clinicId, _req.user);
  }

  @Roles(ADMIN, CLINIC_ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una factura por ID' })
  findOne(
    @Param('id') id: string,
    @Req() _req: any,
  ) {
    return this.service.findOne(id, _req.user);
  }

  @Roles(ADMIN, CLINIC_ADMIN)
  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar una factura' })
  cancel(
    @Param('id') id: string,
    @Req() _req: any,
  ) {
    return this.service.cancel(id, _req.user);
  }

  @Roles(ADMIN, CLINIC_ADMIN)
  @Post(':id/payment')
  @ApiOperation({ summary: 'Registrar un pago para una factura' })
  recordPayment(
    @Param('id') id: string,
    @Body() body: { method: string; amount: number; reference?: string },
    @Req() _req: any,
  ) {
    return this.service.recordPayment(
      id,
      body.method as any,
      body.amount,
      _req.user,
      body.reference,
    );
  }
}
