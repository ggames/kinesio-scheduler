import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Invoice } from '../domain/invoice.entity';
import { InvoiceItem } from '../domain/invoice-item.entity';
import { Payment } from '../domain/payment.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import type { AuthenticatedUser } from '../../../core/auth/roles';
import { AuthorizationService } from '../../../core/auth/authorization.service';

const INVOICE_STATUS_ISSUED = 'ISSUED';
const INVOICE_STATUS_PAID = 'PAID';
const INVOICE_STATUS_CANCELLED = 'CANCELLED';

const PAYMENT_STATUS_PENDING = 'PENDING';
const PAYMENT_STATUS_COMPLETED = 'COMPLETED';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly itemRepo: Repository<InvoiceItem>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  private isInvoicingEnabled(): boolean {
    return this.configService.get<string>('ENABLE_INVOICING') === 'true';
  }

  private async assertClinicAccessOrThrow(
    user: AuthenticatedUser,
    clinicId?: string | null,
  ): Promise<void> {
    if (!clinicId) {
      return;
    }
    await this.authorizationService.assertClinicAccess(user, clinicId);
  }

  async create(
    dto: CreateInvoiceDto,
    user: AuthenticatedUser,
  ): Promise<Invoice> {
    if (!this.isInvoicingEnabled()) {
      throw new BadRequestException(
        'Facturación deshabilitada. Active ENABLE_INVOICING para usar este módulo.',
      );
    }

    const clinicId = dto.clinicId ?? null;
    await this.assertClinicAccessOrThrow(user, clinicId);

    let subtotal = 0;
    for (const item of dto.items) {
      subtotal += item.quantity * item.unitPrice;
    }
    const taxAmount = 0;
    const total = subtotal + taxAmount;

    const invoice = this.invoiceRepo.create({
      patientId: dto.patientId,
      clinicId,
      status: INVOICE_STATUS_ISSUED,
      subtotal,
      taxAmount,
      total,
      isElectronic: false,
    });

    const savedInvoice = await this.invoiceRepo.save(invoice);

    const items = dto.items.map((item) =>
      this.itemRepo.create({
        invoiceId: savedInvoice.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
      }),
    );
    await this.itemRepo.save(items);

    if (dto.paymentMethod && dto.paymentMethod !== 'CASH') {
      const pendingPayment = this.paymentRepo.create({
        invoiceId: savedInvoice.id,
        method: dto.paymentMethod,
        amount: total,
        status: PAYMENT_STATUS_PENDING,
      });
      await this.paymentRepo.save(pendingPayment);
    }

    return this.findOne(savedInvoice.id, user);
  }

  async findAll(
    clinicId?: string | null,
    user?: AuthenticatedUser,
  ): Promise<Invoice[]> {
    if (user && clinicId) {
      await this.assertClinicAccessOrThrow(user, clinicId);
    }
    const where: any = {};
    if (clinicId) {
      where.clinicId = clinicId;
    } else if (user?.clinicId) {
      where.clinicId = user.clinicId;
    }
    return this.invoiceRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<Invoice> {
    const where: Record<string, any> = { id };
    if (user.clinicId) {
      where.clinicId = user.clinicId;
    }
    const invoice = await this.invoiceRepo.findOne({ where });
    if (!invoice) {
      throw new NotFoundException(`Factura ${id} no encontrada`);
    }
    await this.assertClinicAccessOrThrow(user, invoice.clinicId);
    return invoice;
  }

  async cancel(
    id: string,
    user: AuthenticatedUser,
  ): Promise<Invoice> {
    const invoice = await this.findOne(id, user);
    if (invoice.status === INVOICE_STATUS_CANCELLED) {
      throw new BadRequestException(`Factura ${id} ya está cancelada`);
    }
    if (invoice.status === INVOICE_STATUS_PAID) {
      throw new BadRequestException(
        `No se puede cancelar una factura ya pagada`,
      );
    }
    invoice.status = INVOICE_STATUS_CANCELLED;
    return this.invoiceRepo.save(invoice);
  }

  async recordPayment(
    invoiceId: string,
    method: string,
    amount: number,
    user: AuthenticatedUser,
    reference?: string,
  ): Promise<Payment> {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await manager.findOne(Invoice, {
        where: { id: invoiceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) {
        throw new NotFoundException(`Factura ${invoiceId} no encontrada`);
      }
      await this.assertClinicAccessOrThrow(user, invoice.clinicId);
      if (invoice.status === INVOICE_STATUS_PAID) {
        throw new BadRequestException(`Factura ${invoiceId} ya está pagada`);
      }
      if (amount <= 0) {
        throw new BadRequestException('El monto debe ser mayor a cero');
      }
      if (amount > invoice.total) {
        throw new BadRequestException(
          `El monto (${amount}) excede el total de la factura (${invoice.total})`,
        );
      }

      const payment = manager.create(Payment, {
        invoiceId,
        method,
        amount,
        status: PAYMENT_STATUS_COMPLETED,
        reference: reference ?? null,
      });
      const savedPayment = await manager.save(Payment, payment);

      invoice.status = INVOICE_STATUS_PAID;
      await manager.save(Invoice, invoice);

      return savedPayment;
    });
  }
}
