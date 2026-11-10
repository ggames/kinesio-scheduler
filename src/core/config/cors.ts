export function getAllowedOrigins(): string[] {
  const raw = process.env.FRONTEND_URL || 'http://localhost:8081';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Requests without Origin (native apps, curl) are allowed.
 * A wildcard is rejected because it is unsafe together with credentials.
 * Automatic localhost origins are only allowed outside production.
 */
export function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true;

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes('*')) return false;
  if (allowedOrigins.includes(origin)) return true;

  if (process.env.NODE_ENV !== 'production') {
    return (
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
    );
  }

  return false;
}

export function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  callback(null, isOriginAllowed(origin));
}
