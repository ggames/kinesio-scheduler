import { jest } from '@jest/globals';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { Invoice } from '../domain/invoice.entity';
import { Payment } from '../domain/payment.entity';

const userClinicA = { userId: 'user-a', role: 'CLINIC_ADMIN', roles: ['CLINIC_ADMIN'], clinicId: 'clinic-a' } as any;

function buildRepo() {
  return {
    create: (jest.fn() as any).mockImplementation((value: any) => ({ ...value })),
    save: (jest.fn() as any).mockImplementation(async (value: any) => value),
    find: (jest.fn() as any).mockResolvedValue([]),
    findOne: (jest.fn() as any).mockResolvedValue(null),
  };
}

function buildAuthorizationService() {
  return {
    assertClinicAccess: (jest.fn() as any).mockResolvedValue(undefined),
  };
}

describe('InvoicesService', () => {
  let service: InvoicesService;
  let invoiceRepo: ReturnType<typeof buildRepo>;
  let itemRepo: ReturnType<typeof buildRepo>;
  let paymentRepo: ReturnType<typeof buildRepo>;
  let authorization: ReturnType<typeof buildAuthorizationService>;
  let configService: ConfigService;
  let mockManager: any;

  beforeEach(() => {
    invoiceRepo = buildRepo();
    itemRepo = buildRepo();
    paymentRepo = buildRepo();
    authorization = buildAuthorizationService();
    configService = { get: (key: string) => (key === 'ENABLE_INVOICING' ? 'true' : undefined) } as any;

    mockManager = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((entity: any, data: any) => ({
        ...data,
      })),
      save: jest.fn().mockImplementation(async (entity: any, data: any) => data),
    };

    service = new InvoicesService(
      invoiceRepo as any,
      itemRepo as any,
      paymentRepo as any,
      {
        transaction: jest.fn().mockImplementation(async (cb: any) =>
          cb(mockManager)
        ),
      } as any,
      configService,
      authorization as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('crea una factura con ítems y pagos cuando ENABLE_INVOICING=true', async () => {
    const dto: CreateInvoiceDto = {
      patientId: 'patient-1',
      clinicId: 'clinic-a',
      items: [
        { description: 'Consulta', quantity: 1, unitPrice: 5000 },
        { description: 'Terapia', quantity: 2, unitPrice: 2500 },
      ],
    };

    invoiceRepo.findOne.mockResolvedValue({
      id: 'inv-created',
      clinicId: 'clinic-a',
      patientId: 'patient-1',
      total: 10000,
      subtotal: 10000,
      taxAmount: 0,
    });

    const result = await service.create(dto, userClinicA);

    expect(authorization.assertClinicAccess).toHaveBeenCalledWith(
      userClinicA,
      'clinic-a',
    );
    expect(result.total).toBe(10000);
    expect(result.subtotal).toBe(10000);
    expect(invoiceRepo.save).toHaveBeenCalled();
    expect(itemRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ description: 'Consulta', quantity: 1 }),
        expect.objectContaining({ description: 'Terapia', quantity: 2 }),
      ]),
    );
  });

  it('rechaza crear factura si ENABLE_INVOICING no está activo', async () => {
    configService.get = ((key: string) => key === 'ENABLE_INVOICING' ? undefined : undefined) as any;

    const dto: CreateInvoiceDto = {
      patientId: 'patient-1',
      clinicId: 'clinic-a',
      items: [{ description: 'Consulta', quantity: 1, unitPrice: 5000 }],
    };

    await expect(service.create(dto, userClinicA)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza crear factura en clínica ajena', async () => {
    authorization.assertClinicAccess = (jest.fn() as any).mockRejectedValue(
      new ForbiddenException('No tiene acceso a la clínica solicitada'),
    );

    const dto: CreateInvoiceDto = {
      patientId: 'patient-1',
      clinicId: 'clinic-b',
      items: [{ description: 'Consulta', quantity: 1, unitPrice: 5000 }],
    };

    await expect(service.create(dto, userClinicA)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('encuentra una factura por ID y verifica acceso a clínica', async () => {
    const invoice = { id: 'inv-1', clinicId: 'clinic-a', patientId: 'patient-1' };
    invoiceRepo.findOne.mockResolvedValue(invoice);

    await service.findOne('inv-1', userClinicA);

    expect(authorization.assertClinicAccess).toHaveBeenCalledWith(
      userClinicA,
      'clinic-a',
    );
  });

  it('lanza NotFoundException si la factura no existe', async () => {
    invoiceRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne('inv-missing', userClinicA)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('no verifica clínica si la factura no tiene clinicId', async () => {
    const invoice = { id: 'inv-2', clinicId: null, patientId: 'patient-1' };
    invoiceRepo.findOne.mockResolvedValue(invoice);

    await service.findOne('inv-2', userClinicA);

    expect(authorization.assertClinicAccess).not.toHaveBeenCalled();
  });

  it('cancela una factura y verifica acceso a clínica', async () => {
    const invoice = {
      id: 'inv-3',
      clinicId: 'clinic-a',
      status: 'ISSUED',
      patientId: 'patient-1',
    };
    invoiceRepo.findOne.mockResolvedValue(invoice);

    await service.cancel('inv-3', userClinicA);

    expect(authorization.assertClinicAccess).toHaveBeenCalledWith(
      userClinicA,
      'clinic-a',
    );
    expect(invoiceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'CANCELLED' }),
    );
  });

  it('rechaza cancelar factura de clínica ajena', async () => {
    const invoice = {
      id: 'inv-4',
      clinicId: 'clinic-b',
      status: 'ISSUED',
      patientId: 'patient-1',
    };
    invoiceRepo.findOne.mockResolvedValue(invoice);
    authorization.assertClinicAccess = (jest.fn() as any).mockRejectedValue(
      new ForbiddenException('No tiene acceso a la clínica solicitada'),
    );

    await expect(service.cancel('inv-4', userClinicA)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('registra un pago y verifica acceso a clínica', async () => {
    const invoice = {
      id: 'inv-5',
      clinicId: 'clinic-a',
      status: 'ISSUED',
      patientId: 'patient-1',
    };
    mockManager.findOne.mockResolvedValue(invoice);

    await service.recordPayment('inv-5', 'CARD', 10000, userClinicA, 'ref-1');

    expect(authorization.assertClinicAccess).toHaveBeenCalledWith(
      userClinicA,
      'clinic-a',
    );
    expect(mockManager.save).toHaveBeenNthCalledWith(1,
      Payment,
      expect.objectContaining({ method: 'CARD', amount: 10000, status: 'COMPLETED' }),
    );
    expect(mockManager.save).toHaveBeenNthCalledWith(2,
      Invoice,
      expect.objectContaining({ status: 'PAID' }),
    );
  });

  it('lista facturas filtrando por clínica cuando se pasa clinicId', async () => {
    invoiceRepo.find.mockResolvedValue([{ id: 'inv-6', clinicId: 'clinic-a' }]);

    const result = await service.findAll('clinic-a', userClinicA);

    expect(result).toHaveLength(1);
    expect(invoiceRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clinicId: 'clinic-a' }, order: { createdAt: 'DESC' } }),
    );
  });
});
