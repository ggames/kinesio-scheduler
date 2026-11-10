#!/usr/bin/env bash
set -euo pipefail

# Creates a compressed PostgreSQL backup.
# Usage: DB_URL=postgres://... ./scripts/backup.sh [output-dir]
# Or use the same DB_* variables as the application.

OUTPUT_DIR="${1:-backups}"
mkdir -p "$OUTPUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUTPUT_DIR/kinesiology-$STAMP.dump"

if [[ -n "${DB_URL:-}" ]]; then
  pg_dump --format=custom --no-owner --no-privileges --file="$FILE" "$DB_URL"
else
  export PGPASSWORD="${DB_PASS:-}"
  pg_dump \
    --host="${DB_HOST:-localhost}" \
    --port="${DB_PORT:-5432}" \
    --username="${DB_USER:-postgres}" \
    --dbname="${DB_DATABASE:-kinesiology}" \
    --format=custom --no-owner --no-privileges \
    --file="$FILE"
fi

echo "Backup creado: $FILE"
