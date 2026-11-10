import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { resolveClinicId } from '../clinic-scope';

/**
 * Resolves the clinic scope for the current request using the authenticated
 * user and the optional `X-Clinic-Id` header (only honoured for global ADMIN).
 */
export const ClinicScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return resolveClinicId(
      request.user,
      request.headers?.['x-clinic-id'] as string | undefined,
    );
  },
);
