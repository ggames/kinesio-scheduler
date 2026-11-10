<<<<<<< HEAD
# kinesiology-backend
=======
# Kinesiology Scheduler API

Backend NestJS para la gestión de turnos de una clínica de kinesiología.

## Arquitectura y patrones

- **NestJS (TypeScript)** con tipado estricto.
- **Arquitectura hexagonal y vertical slicing:** módulos verticales con capas `domain`, `application` e `infrastructure`.
- **Base de datos:** PostgreSQL 14+ con TypeORM y migraciones.
- **Autenticación:** JWT con RBAC (`ADMIN`, `CLINIC_ADMIN`, `STAFF`, `PATIENT`) y contraseñas con bcrypt.
- **Tiempo real:** WebSockets autenticados.
- **Documentación API:** Swagger (deshabilitado en producción por defecto).

## Requisitos

- Node.js 20 o superior.
- PostgreSQL 14 o superior.

## Instalación

```bash
npm install
cp .env.example .env
```

Completar `.env`. `JWT_SECRET` debe tener al menos 32 caracteres.

Variables principales:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_DATABASE=kinesiology
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true
JWT_SECRET=...
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:8081
```

`DB_URL` tiene prioridad sobre los parámetros individuales. En producción, mantenga `DB_SSL_REJECT_UNAUTHORIZED=true` salvo que el proveedor no exponga una CA válida.

## Migraciones

El esquema se gestiona exclusivamente con migraciones; `synchronize` está deshabilitado.

```bash
# Ver estado
npm run migration:show

# Aplicar migraciones
npm run migration:run

# Revertir la última migración
npm run migration:revert

# Verificar que no haya drift entre entidades y base de datos
npm run migration:check
```

Para una base descartable, recrear el esquema antes de aplicar la baseline:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

## Ejecución

```bash
# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod
```

## Pruebas

```bash
# Unitarias
npm test

# End-to-end (requiere una base PostgreSQL de test)
cp .env.test.example .env.test
npm run test:e2e

# Cobertura
npm run test:cov
```

CI se ejecuta en GitHub Actions con PostgreSQL: lint, typecheck, tests con umbral
mínimo de cobertura, migraciones, detección de drift, build, E2E y `npm audit`
nivel high. Ver `.github/workflows/ci.yml`.

## Multi-clínica

- `ADMIN` es global y puede operar sobre cualquier clínica; puede fijar el scope
  con el header `X-Clinic-Id`.
- `CLINIC_ADMIN` y `STAFF` quedan limitados a la clínica asignada en `users.clinicId`.
  Solicitar otra clínica devuelve `403`.
- Pacientes, turnos, tratamientos, notas clínicas y adjuntos guardan `clinicId`
  obligatorio y las lecturas se filtran por clínica.
- Los reportes aceptan el scope de clínica del usuario autenticado.
- Plan de la fase y estado: [`docs/fase-6.md`](docs/fase-6.md).

## Autenticación

- `POST /auth/login` y `POST /auth/register-patient` son públicos.
- `POST /auth/register-professional` requiere rol `ADMIN`.
- Las cuentas de profesionales se crean en estado `PENDING` y se activan con un token de 24 h.
- El token de activación se guarda hasheado. El enlace se devuelve en la respuesta **solo en desarrollo**.
- Los emails de activación se encolan en `email_outbox` y se envían por SMTP con reintentos. La URL de activación se guarda cifrada en la cola.
- Para desarrollo local se puede usar MailHog en `localhost:1025` con `MAIL_ENABLED=true`.
- Política de contraseña: mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número.
- Al cambiar la contraseña se invalidan todas las sesiones previas del usuario.
- Login y endpoints públicos tienen rate limiting estricto. Tras varios fallos, la cuenta se bloquea temporalmente.
- El access token dura 15 minutos. Login, registro y activación devuelven también un `refresh_token` opaco.
- `POST /auth/refresh` (público) rota el refresh token y detecta reutilización: si un token revocado se vuelve a usar, se revoca toda su familia.
- `POST /auth/logout` revoca el access token y, opcionalmente, el refresh token enviado en el body.
- `POST /auth/logout-all` cierra todas las sesiones e invalida los tokens emitidos.
- Los eventos de autenticación se registran en `audit_logs` con `requestId`, IP y user agent; los emails se hashean con HMAC.

## Turnos y flujo clínico

- Estados de turno: `SCHEDULED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.
  Las transiciones se validan con una máquina de estados y las citas en estado
  terminal no se reabren.
- `POST /appointments` reserva un slot respetando `maxCapacity` (sesiones grupales),
  evita superponer turnos del mismo paciente en el día y bloquea fechas pasadas
  para pacientes (el staff puede cargar datos históricos).
- `GET /appointments` acepta filtros `dateFrom`, `dateTo`, `status`,
  `professionalId`, `patientId`, `page` y `limit`. Devuelve `{ data, total, page, limit }`.
  Los profesionales solo ven sus propios turnos.
- Endpoints de ciclo de vida:
  - `PATCH /appointments/:id/confirm`
  - `PATCH /appointments/:id/complete` (registra la sesión del tratamiento)
  - `PATCH /appointments/:id/no-show`
  - `PATCH /appointments/:id/cancel`
  - `PATCH /appointments/:id/reschedule`
- Un paciente puede cancelar o reprogramar con al menos
  `CANCELLATION_WINDOW_HOURS` horas de anticipación (24 por defecto). Solo el
  profesional tratante o un `ADMIN` puede completar un turno.
- Los turnos vencidos sin completar se marcan automáticamente como `NO_SHOW`.
  Los recordatorios de turnos de las próximas 24 h se encolan cada 15 minutos.
- Una reconciliación diaria recalcula `currentBookings`, cierra tratamientos que
  alcanzaron su total de sesiones y reporta anomalías de sesiones excedidas.
- `CANCELLED` y `NO_SHOW` liberan capacidad; el contador `currentBookings` es una
  caché y los turnos activos son la fuente de verdad.

### Tratamientos y sesiones

- `POST /treatments` crea un plan con `totalSessions`; `GET /treatments` y
  `GET /treatments/:id` respetan el rol y la relación clínica.
- `GET /treatments/:id/sessions` lista las sesiones completadas.
- Completar un turno con tratamiento asociado registra una `treatment_session`
  idempotente (una por turno) y marca el tratamiento como `COMPLETED` al llegar
  al total de sesiones.

### Historia clínica y notas

- `POST /medical-histories`, `PUT /medical-histories/:id` y
  `DELETE /medical-histories/:id` requieren profesional tratante o `ADMIN`.
- `DELETE /medical-histories/:id` es un archivado lógico: completa `archivedAt` y
  `archivedByUserId`; no borra datos.
- `POST /clinical-notes` crea una nota en borrador; `PATCH /clinical-notes/:id`
  solo funciona mientras no esté firmada.
- `POST /clinical-notes/:id/sign` firma la nota. Una nota firmada es inmutable.
- Los pacientes solo pueden leer sus propias notas firmadas.

### Reportes

- `GET /reports/absenteeism-abandonment` usa `NO_SHOW` y sesiones reales para
  detectar ausentismo y abandono; acepta `fechaInicio`, `fechaFin` y
  `professionalId`.
- `GET /reports/agenda-occupancy` calcula capacidad real de slots y turnos no
  cancelados por profesional, sin estimaciones fijas.

## Administración y privacidad

- `GET/POST/PATCH /users` (solo `ADMIN`): listado paginado, creación de staff,
  cambio de roles/estado y `POST /users/:id/revoke-sessions`.
- Pacientes, profesionales y personas usan borrado lógico (`archivedAt`). Los
  profesionales además tienen `isActive`/`deactivatedAt` y endpoints
  `PATCH /professionals/:id/deactivate|reactivate`.
- Catálogos (`/health-insurances`, `/resources`, `/clinic`, `/holiday`) aceptan
  paginación y búsqueda; los dos primeros ya soportan actualización y borrado.
- `GET /audit-logs` (ADMIN) pagina y filtra eventos; `GET /audit-logs/export`
  descarga CSV (máx. 10k filas, protegido contra CSV injection).
- `GET /privacy/patients/:id/export` exporta todos los datos del paciente y
  `POST /privacy/patients/:id/anonymize` anonimiza PII de forma irreversible
  (`confirm: true`). Las notas clínicas se conservan por obligación legal.
- Las lecturas individuales de historia clínica y notas generan eventos
  `MEDICAL_HISTORY_VIEWED`/`CLINICAL_NOTE_VIEWED`.
- La retención diaria (04:00) purga auditoría, intentos de login, outbox enviado,
  idempotencia vencida y buckets de rate limit según variables `*_RETENTION_DAYS`.

## Notificaciones

- Preferencias por usuario: `GET/PATCH /notifications/preferences`
  (`emailEnabled`, `appointmentReminders`, `appointmentChanges`).
- Administración de outbox: `GET /notifications/outbox`,
  `POST /notifications/outbox/:id/retry` y
  `POST /notifications/outbox/retry-failed`.
- `REMINDER_HOURS` define la ventana de recordatorios (24 por defecto).

## Salud y operación

- `GET /health` verifica la conexión a PostgreSQL y devuelve 503 si falla.
- `GET /health/live` solo verifica que el proceso esté vivo.
- `GET /health/ready` verifica base de datos y que no haya migraciones pendientes.
- `GET /metrics` expone métricas Prometheus. En producción requiere
  `METRICS_ENABLED=true` o `METRICS_TOKEN` (header `Authorization: Bearer ...`).
- Los logs son JSON por línea (`LOG_LEVEL=error` reduce el ruido).
- Cada request recibe `X-Request-Id`; los errores 5xx se registran con ese identificador.
- Las tareas programadas usan locks en PostgreSQL (`cron_locks`), seguros con
  múltiples réplicas.
- `POST /appointments` acepta `Idempotency-Key`; la misma clave con el mismo
  payload devuelve la respuesta original y evita turnos duplicados.
- `RATE_LIMIT_STORE=postgres` habilita límites compartidos entre instancias.
- Docker: `docker build -t kinesiology .`; `docker compose up` levanta PostgreSQL,
  MailHog y la app. Migrar antes de escalar réplicas con
  `npm run migration:run:prod`.
- Ver `docs/runbook.md` para despliegue, backups, restauración, rotación de secretos e incidentes.

## Emails

Variables principales:

```env
MAIL_ENABLED=false
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_SECURE=false
MAIL_USER=
MAIL_PASS=
MAIL_FROM=no-reply@kinesiology.local
MAIL_FROM_NAME=Kinesiology Scheduler
MAIL_MAX_ATTEMPTS=5
```

Si `MAIL_ENABLED=false` o falta `MAIL_HOST`, los emails quedan en `email_outbox` sin enviarse. El procesador corre cada minuto y usa reintentos exponenciales.
El outbox se administra desde `/notifications/outbox` y respeta las preferencias
de cada usuario. Los recordatorios usan `REMINDER_HOURS` (24 por defecto).

## Swagger

Disponible en `http://localhost:3000/docs` fuera de producción. En producción se puede habilitar con `SWAGGER_ENABLED=true`.
>>>>>>> 6d20ae7 (backend actualizado y optimizado)
