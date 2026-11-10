# Runbook operativo

Guía para despliegue, respaldo, restauración e incidentes de Kinesiology Scheduler.

## 1. Checklist de despliegue

1. Configurar las variables de `.env` en el proveedor. En producción son obligatorias:
   - `JWT_SECRET` (mínimo 32 caracteres).
   - `DB_URL` o `DB_HOST` con credenciales válidas.
   - `MAIL_*` si `MAIL_ENABLED=true`.
2. Ejecutar migraciones antes de iniciar la nueva versión:
   ```bash
   npm run migration:run
   npm run migration:check
   ```
3. Compilar e iniciar:
   ```bash
   npm run build
   npm run start:prod
   ```
4. Verificar salud:
   ```bash
   curl -fsS https://<host>/health
   ```
   Debe responder `{ "status": "ok", "database": "up" }`.
5. Verificar que `/docs` esté deshabilitado en producción o protegido por red.

## 2. Respaldos

Usar el respaldo gestionado del proveedor (Neon, Supabase, RDS) siempre que exista.
Como respaldo adicional:

```bash
pg_dump "$DB_URL" --format=custom --no-owner --file=backup-$(date +%F-%H%M).dump
```

- Frecuencia recomendada: diaria.
- Retención mínima: 14 días.
- Almacenar fuera de la base de datos y cifrado en reposo.
- Probar la restauración al menos una vez por trimestre.

## 3. Restauración

En una base nueva o descartable:

```bash
pg_restore --clean --if-exists --no-owner --dbname="$DB_URL" backup-YYYY-MM-DD-HHMM.dump
npm run migration:show
npm run migration:check
```

Nunca ejecutar `synchronize` ni borrar el esquema en producción. Para recrear una
base descartable:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

Luego aplicar migraciones desde cero.

## 4. Migraciones y rollback

- Aplicar: `npm run migration:run`.
- Ver estado: `npm run migration:show`.
- Detectar drift: `npm run migration:check` (falla si el esquema no coincide).
- Revertir la última: `npm run migration:revert`.

Antes de revertir en producción, hacer backup y revisar si la migración eliminó
datos. Preferir migraciones expand-contract: agregar columnas/tablas, desplegar,
migrar datos y recién después eliminar lo obsoleto.

## 5. Rotación de secretos

### JWT_SECRET

1. Generar un valor aleatorio de al menos 32 caracteres.
2. Actualizar el secreto en el proveedor.
3. Reiniciar la aplicación.
4. Todos los access y refresh tokens previos quedan inválidos; los usuarios deben
   volver a iniciar sesión.

### MAIL_ENCRYPTION_KEY / LOGIN_ATTEMPT_SECRET / AUDIT_HASH_SECRET

Cambiarlos invalida los datos derivados existentes:

- `MAIL_ENCRYPTION_KEY`: los emails pendientes en `email_outbox` no podrán
  descifrarse. Vaciar la cola pendiente antes de rotar.
- `LOGIN_ATTEMPT_SECRET`: se pierde el historial de bloqueos por email; los
  bloqueos activos dejan de aplicar hasta el próximo fallo.
- `AUDIT_HASH_SECRET`: los hashes de email de auditoría anteriores no serán
  comparables con los nuevos.

## 6. Incidentes de autenticación

- Revisar `audit_logs` filtrando por `eventType`, `createdAt` y `actorUserId`.
- `REFRESH_TOKEN_REUSE` indica posible robo de refresh token; la familia completa
  fue revocada automáticamente.
- Para cerrar todas las sesiones de un usuario: `POST /auth/logout-all`.
- Para forzar cierre global: rotar `JWT_SECRET` y reiniciar.
- Los bloqueos temporales están en `login_attempts`; se liberan solos al vencer
  `lockedUntil`. No editar manualmente salvo incidente justificado.

## 7. Emails y SMTP

- Si `MAIL_ENABLED=false`, los correos quedan `PENDING` en `email_outbox`.
- El procesador reintenta cada minuto con backoff exponencial.
- Revisar fallos:
  ```sql
  SELECT id, "to", status, attempts, "lastError", "nextAttemptAt"
  FROM email_outbox
  WHERE status <> 'SENT'
  ORDER BY "createdAt" DESC
  LIMIT 50;
  ```
- Antes de reintentar manualmente, corregir la causa (credenciales, host, puerto).

## 8. Rate limiting y proxies

- Con una sola instancia, `RATE_LIMIT_STORE=memory` es suficiente.
- Con varias réplicas, usar `RATE_LIMIT_STORE=postgres`: los contadores viven en
  `rate_limit_buckets` y se actualizan atómicamente. La tabla se purga en la tarea
  diaria de retención.
- Detrás de un proxy confiable, configurar `TRUST_PROXY=true` o el número de saltos.
  No activarlo si el cliente puede falsificar `X-Forwarded-For`.

## 9. Observabilidad

- Cada request recibe `X-Request-Id`; los errores 5xx se registran con ese ID.
- `/health` verifica la base de datos; `/health/live` indica proceso vivo;
  `/health/ready` además falla si hay migraciones pendientes.
- `/metrics` expone `http_requests_total` y `http_request_duration_seconds` en
  formato Prometheus. En producción configurar `METRICS_TOKEN` y proteger la ruta.
- Logs en JSON por línea. `LOG_LEVEL=error` deja solo errores.
- Alertar si `/health/ready` falla repetidamente, si crecen los
  `REFRESH_TOKEN_REUSE`, si el p95 de latencia sube o si `email_outbox`
  acumula fallos.
- Los errores incluyen `code` estable (`NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, etc.)
  además de `statusCode` y `requestId`.

## 10. Turnos y datos clínicos

- Estados de turno: `SCHEDULED -> CONFIRMED -> COMPLETED`, con salidas a
  `CANCELLED` y `NO_SHOW`. Las transiciones inválidas devuelven 409.
- La tarea de expiración marca como `NO_SHOW` los turnos `SCHEDULED` cuyo horario
  ya terminó. La tarea de recordatorios encola emails para turnos de las próximas
  24 h cada 15 minutos y usa `reminderSentAt` para no duplicar.
- La reconciliación diaria (03:00) recalcula `time_slots.currentBookings`, cierra
  tratamientos activos que alcanzaron su total de sesiones y registra en logs las
  anomalías de sesiones excedidas.
- `CANCELLATION_WINDOW_HOURS` controla la anticipación mínima de pacientes para
  cancelar o reprogramar. Por defecto 24.
- `CANCELLED` y `NO_SHOW` no ocupan capacidad. Si un reporte de ocupación parece
  desactualizado, recalcular con `GET /reports/agenda-occupancy`; no confiar en
  `time_slots.currentBookings` como fuente de verdad.
- Las notas clínicas firmadas (`clinical_notes.signedAt`) son inmutables. Ante un
  error de contenido, crear una nota nueva; no actualizar la firmada por SQL.
- Las historias clínicas se archivan con `archivedAt`/`archivedByUserId`. Para
  restaurar una historia archivada, limpiar ambos campos con autorización y dejar
  registro de auditoría.
- Revisar integridad de tratamientos/sesiones:
  ```sql
  SELECT t.id, t."totalSessions", COUNT(s.id) AS sesiones
  FROM treatments t
  LEFT JOIN treatment_sessions s ON s."treatmentId" = t.id
  GROUP BY t.id
  HAVING COUNT(s.id) > t."totalSessions";
  ```
  No debería devolver filas; si devuelve, investigar antes de modificar datos.

## 11. Retención, privacidad y datos administrativos

- La tarea diaria de retención (04:00) elimina:
  - `audit_logs` mayores a `AUDIT_RETENTION_DAYS` (365 por defecto),
  - `login_attempts` mayores a `LOGIN_ATTEMPT_RETENTION_DAYS` (30),
  - `email_outbox` en estado `SENT` mayor a `OUTBOX_RETENTION_DAYS` (90),
  - `idempotency_keys` vencidas, `rate_limit_buckets` antiguos y locks huérfanos.
- La retención corre bajo lock `retention.purge`; es seguro con varias réplicas.
- Exportación de datos de paciente (ADMIN):
  `GET /privacy/patients/:id/export`.
- Anonimización irreversible (ADMIN):
  `POST /privacy/patients/:id/anonymize` con `{ "confirm": true }`.
  Anonimiza persona y cuenta de usuario, archiva paciente y revoca sesiones.
  **No borra notas clínicas ni turnos** (obligación legal/auditoría).
- Borrado de pacientes/profesionales/personas es lógico. Restaurar un paciente con
  `PATCH /patients/:id/restore`; un profesional se reactiva con
  `PATCH /professionals/:id/reactivate`.
- `POST /appointments` acepta `Idempotency-Key`. Si el cliente reintenta, debe
  reutilizar la misma clave y el mismo payload; un payload distinto devuelve 409.
- Administración de usuarios: `GET/PATCH /users`, `POST /users/:id/revoke-sessions`.
  Desactivar un usuario incrementa `tokenVersion` y revoca refresh tokens.

## 12. Respaldos con scripts

- Crear backup: `DB_URL=postgres://... ./scripts/backup.sh [directorio]`.
- Restaurar: `DB_URL=postgres://... ./scripts/restore.sh backups/archivo.dump`.
- Probar la restauración al menos una vez por trimestre en una base descartable.
- En Docker, ejecutar los scripts desde una imagen que incluya `pg_dump`/`pg_restore`
  (por ejemplo, la imagen oficial `postgres:16-alpine`).

## 13. Apagado

La aplicación tiene shutdown hooks habilitados. En el orquestador enviar `SIGTERM`
y esperar el período de gracia antes de matar el proceso.
