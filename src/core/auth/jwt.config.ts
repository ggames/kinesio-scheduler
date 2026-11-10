import { ConfigService } from '@nestjs/config';

const MIN_SECRET_LENGTH = 32;

/**
 * Fail-fast: never fall back to a hardcoded secret.
 */
export function getJwtSecret(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET');
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be defined and at least ${MIN_SECRET_LENGTH} characters long`,
    );
  }
  return secret;
}
