import { jest } from '@jest/globals';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const dataSource = { query: (jest.fn() as any) };
  let service: ReportsService;

  beforeEach(() => {
    dataSource.query.mockReset();
    service = new ReportsService(dataSource as any);
  });

  describe('obtenerResumenTratamientos', () => {
    it('debe agrupar por estado y calcular porcentajes', async () => {
      dataSource.query.mockResolvedValue([
        { status: 'ACTIVE', total: 3 },
        { status: 'COMPLETED', total: 1 },
      ]);

      const result = await service.obtenerResumenTratamientos({
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        professionalId: 'prof-1',
      });

      expect(result).toEqual([
        { status: 'ACTIVE', total: 3, porcentaje: 75 },
        { status: 'COMPLETED', total: 1, porcentaje: 25 },
      ]);
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM treatments t'),
        ['2026-01-01', '2026-12-31', 'prof-1', null],
      );
    });

    it('debe retornar lista vacía y evitar división por cero', async () => {
      dataSource.query.mockResolvedValue([]);

      const result = await service.obtenerResumenTratamientos({});

      expect(result).toEqual([]);
    });
  });
});
