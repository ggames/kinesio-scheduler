import { jest } from '@jest/globals';
import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';

function buildContext() {
  const request = {
    ip: '127.0.0.1',
    method: 'POST',
    route: { path: '/auth/login' },
    body: { email: 'Kine@Test.com' },
  };
  const response = { setHeader: (jest.fn() as any) };

  return {
    context: {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as any,
    response,
  };
}

function buildGuard(limit = 2) {
  const configService = {
    get: (jest.fn() as any).mockImplementation((key: string) => {
      if (key === 'THROTTLE_LIMIT') return String(limit);
      if (key === 'THROTTLE_TTL_MS') return '60000';
      return undefined;
    }),
  };
  const reflector = {
    getAllAndOverride: (jest.fn() as any).mockReturnValue(undefined),
  };

  return new RateLimitGuard(
    reflector as unknown as Reflector,
    configService as unknown as ConfigService,
  );
}

describe('RateLimitGuard', () => {
  it('debe permitir solicitudes dentro del límite y bloquear el excedente', () => {
    const guard = buildGuard(2);
    const { context, response } = buildContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Retry-After',
      expect.any(String),
    );
  });

  it('debe usar el límite específico del endpoint', () => {
    const guard = buildGuard(100);
    const reflector = (guard as any).reflector;
    reflector.getAllAndOverride.mockReturnValue({ limit: 1, ttlMs: 60_000 });
    const { context } = buildContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
  });

  it('no debe limitar contextos que no sean HTTP', () => {
    const guard = buildGuard(1);
    const context = { getType: () => 'ws' } as any;

    expect(guard.canActivate(context)).toBe(true);
  });
});
