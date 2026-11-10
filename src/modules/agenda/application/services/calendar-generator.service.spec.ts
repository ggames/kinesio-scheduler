import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { CalendarGeneratorService } from './calendar-generator.service';
import { DoctorScheduleTemplate } from '../../doctor-schedule-template/domain/doctor-schedule-template.entity';
import { DailyAgenda } from '../../daily-agenda/domain/daily-agenda.entity';
import { TimeSlot } from '../../time-slot/domain/time-slot.entity';
import { Holiday } from '../../holiday/domain/holiday.entity';
import { Professional } from '../../../professionals/domain/professional.entity';
import { Clinic } from '../../clinic/domain/clinic.entity';
import { WeeklySchedule } from '../../weekly-schedule/domain/weekly-schedule.entity';

describe('CalendarGeneratorService', () => {
  let service: CalendarGeneratorService;

  const mockProf = { id: 'prof-1' };
  const mockClinic = { id: 'clinic-1', name: 'Clínica Central de Kinesiología' };

  const queryRunnerMock = {
    connect: (jest.fn() as any).mockResolvedValue(undefined),
    startTransaction: (jest.fn() as any).mockResolvedValue(undefined),
    commitTransaction: (jest.fn() as any).mockResolvedValue(undefined),
    rollbackTransaction: (jest.fn() as any).mockResolvedValue(undefined),
    release: (jest.fn() as any).mockResolvedValue(undefined),
    manager: {
      findOne: (jest.fn() as any).mockResolvedValue(null),
      create: (jest.fn() as any).mockImplementation((_entity: any, dto: any) => ({ id: 'gen-id', ...dto })),
      save: (jest.fn() as any).mockImplementation(async (_entity: any, entity: any) => entity),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarGeneratorService,
        {
          provide: getRepositoryToken(DoctorScheduleTemplate),
          useValue: {
            find: (jest.fn() as any).mockResolvedValue([]),
            count: (jest.fn() as any).mockResolvedValue(0),
            create: (jest.fn() as any).mockImplementation((dto: any) => ({ id: 'tpl-id', ...dto })),
            save: (jest.fn() as any).mockImplementation(async (entities: any) => entities),
          },
        },
        {
          provide: getRepositoryToken(DailyAgenda),
          useValue: { find: (jest.fn() as any).mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(TimeSlot),
          useValue: { find: (jest.fn() as any).mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Holiday),
          useValue: { find: (jest.fn() as any).mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Professional),
          useValue: { find: (jest.fn() as any).mockResolvedValue([mockProf]) },
        },
        {
          provide: getRepositoryToken(Clinic),
          useValue: {
            findOne: (jest.fn() as any).mockResolvedValue(mockClinic),
            create: (jest.fn() as any).mockImplementation((dto: any) => ({ id: 'clinic-1', ...dto })),
            save: (jest.fn() as any).mockImplementation(async (entity: any) => entity),
          },
        },
        {
          provide: getRepositoryToken(WeeklySchedule),
          useValue: {
            count: (jest.fn() as any).mockResolvedValue(0),
            create: (jest.fn() as any).mockImplementation((dto: any) => ({ id: 'ws-id', ...dto })),
            save: (jest.fn() as any).mockImplementation(async (entities: any) => entities),
          },
        },
        {
          provide: getDataSourceToken(),
          useValue: {
            createQueryRunner: (jest.fn() as any).mockReturnValue(queryRunnerMock),
          },
        },
      ],
    }).compile();

    service = module.get<CalendarGeneratorService>(CalendarGeneratorService);
  });

  it('debe inicializarse y sembrar plantillas/agendas de 2 meses al ejecutarse onModuleInit', async () => {
    await service.onModuleInit();
    expect(service).toBeDefined();
  });

  it('debe generar ventana deslizante de 60 días para los profesionales', async () => {
    const result = await service.generateRollingWindowFor60Days();
    expect(result).toBeDefined();
    expect(result.professionalsProcessed).toBe(1);
    expect(result.startDate).toBeDefined();
    expect(result.endDate).toBeDefined();
  });
});
