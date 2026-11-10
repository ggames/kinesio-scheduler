#!/usr/bin/env bash
set -euo pipefail

# Restores a PostgreSQL custom-format backup.
# Usage: DB_URL=postgres://... ./scripts/restore.sh backups/file.dump
# WARNING: this can overwrite existing data.

if [[ $# -ne 1 ]]; then
  echo "Uso: $0 <archivo.dump>" >&2
  exit 1
fi

FILE="$1"
if [[ ! -f "$FILE" ]]; then
  echo "No existe el archivo: $FILE" >&2
  exit 1
fi

if [[ -n "${DB_URL:-}" ]]; then
  pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DB_URL" "$FILE"
else
  export PGPASSWORD="${DB_PASS:-}"
  pg_restore \
    --host="${DB_HOST:-localhost}" \
    --port="${DB_PORT:-5432}" \
    --username="${DB_USER:-postgres}" \
    --dbname="${DB_DATABASE:-kinesiology}" \
    --clean --if-exists --no-owner --no-privileges \
    "$FILE"
fi

echo "Restauración completada desde: $FILE"
