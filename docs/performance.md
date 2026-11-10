# Performance y capacidad

## Objetivos iniciales

- p95 de endpoints de lectura < 300 ms con 50 usuarios concurrentes.
- p95 de creación de turnos < 500 ms.
- 0 errores 5xx sostenidos durante una prueba de 10 minutos.

## Prueba de carga (k6)

El script `test/load/appointments.js` es opcional y no corre en CI. Requiere una
cuenta de staff y un `timeSlotId` válido:

```bash
k6 run \
  -e BASE_URL=https://staging.example.com \
  -e ACCESS_TOKEN=... \
  -e TIME_SLOT_ID=... \
  test/load/appointments.js
```

## Consultas e índices

- Búsquedas de pacientes/profesionales usan `ILIKE %texto%`; para volúmenes
  grandes evaluar `pg_trgm` + índices GIN.
- `isTreatingProfessional` usa índices compuestos:
  - `appointments(professionalId, patientId)`
  - `treatments(prescribingProfessionalId, patientId)`
- La caché `time_slots.currentBookings` no se usa como fuente de verdad.
- Los listados administrativos, auditoría y outbox están paginados (máx. 100).

## Pool de conexiones

Configurar `DB_OPTIONS`/variables del proveedor según la instancia. Con muchas
réplicas, mantener `(réplicas × pool) < max_connections` de PostgreSQL. Para Neon,
usar el endpoint pooled cuando esté disponible.

## Crecimiento y archivo

- `audit_logs` y `email_outbox` crecen con el uso. La retención diaria los poda.
- Para tablas de decenas de millones de filas, evaluar particionado mensual por
  `createdAt` y archivo a almacenamiento frío.
- Antes de cambiar índices en producción, medir con `EXPLAIN (ANALYZE, BUFFERS)`
  sobre una copia representativa.
