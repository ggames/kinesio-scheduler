/**
 * Normalizes an email for storage and lookups. PostgreSQL unique constraints are
 * case-sensitive by default, so every path must use the same normalization.
 */
export function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}
