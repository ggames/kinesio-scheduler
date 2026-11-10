# Fase 6 — Producción, multi-clínica real y cierre funcional

> Plan propuesto a partir del estado del repositorio al cierre de la Fase 5.
> Orden sugerido: 6.1 → 6.2 → 6.6 (base) → 6.3 → 6.4 → 6.5 → 6.7.

## Objetivo

Cerrar la brecha entre el MVP funcional y un sistema listo para operar con
múltiples clínicas en producción: aislamiento de datos por clínica, adjuntos
robustos, notificaciones reales, observabilidad, seguridad y calidad sostenida.

---

## 6.1 Multi-clínica end-to-end (prioridad alta)

- [x] `clinicId` obligatorio en `appointments`, `treatments`, `clinical_notes`
  y `clinical_attachments` (backfill + migración `Phase6ClinicScope`).
- [x] Rol `CLINIC_ADMIN`, `users.clinicId` y claim `clinicId` en el JWT.
- [x] Resolución de scope (helper + decorador `@ClinicScope`) con header
  `X-Clinic-Id` solo para `ADMIN`.
- [x] Scoping en pacientes, turnos, tratamientos, notas clínicas, adjuntos y
  reportes.
- [x] Tests e2e de aislamiento: clínica A no puede leer ni mutar datos de B.
- [ ] Pendiente: scoping de auditoría y outbox por clínica.
- **Aceptación:** 0 consultas clínicas sin filtro de clínica; e2e de
  aislamiento verde.

**Estado:** base multi-clínica implementada y verificada (lint, typecheck,
177 tests, build, 24 e2e, `migration:check`).

## 6.2 Adjuntos de producción

- Reemplazar base64 por `multipart/form-data` (`FileInterceptor`), descarga en
  streaming (`StreamableFile`), límite 10 MB y allowlist MIME.
- `StorageProvider` abstracto (local/S3), URLs firmadas, checksum SHA-256 y hook
  de antivirus.
- Migración: `checksum`, `storageKey`, `deletedAt`; borrado lógico.
- Tests unitarios + e2e de subida/descarga/permisos.

## 6.3 SMS/WhatsApp y recordatorios

- Proveedor real (Twilio o WhatsApp Cloud API) detrás de `SMS_PROVIDER`; en
  desarrollo se mantiene `LogSmsProvider`.
- Preferencias de canal (`email`/`sms`/`whatsapp`) con opt-in y consentimiento.
- Cron de recordatorio T-24 h con idempotencia, reintentos y plantillas.
- Métricas y auditoría de envíos.
- **Aceptación:** un recordatorio por turno; un fallo del proveedor reintenta sin
  bloquear el flujo principal.

## 6.4 Observabilidad y operación

- Health extendido: SMTP, SMS y storage; readiness de outbox y jobs.
- Métricas de negocio: outbox pendiente/fallida, recordatorios, adjuntos;
  alertas asociadas.
- Outbox DLQ + reintento manual; purga programada de tokens, outbox e
  idempotency.
- `requestId` propagado a jobs y tareas programadas.

## 6.5 Seguridad y cumplimiento

- Revisión OWASP: uploads, rate-limit por usuario/IP, CORS, rotación de secretos
  y HMAC.
- Retención/anonimización de PII y export legal (módulo privacy).
- Backup/restore documentado y runbook de incidentes; `npm audit` a 0
  high/moderate.

## 6.6 Calidad y CI/CD

- Cobertura a 55/45/40/55.
- E2E completos: reset password, portal paciente, `/notifications/mine`,
  adjuntos multipart y aislamiento multi-clínica.
- Contract tests OpenAPI, smoke de migraciones y CI Node 20/22 (CodeQL ya
  existe).
- Docker multi-stage + compose prod-like + pipeline de deploy con
  `migration:run:prod`.
- Smoke de performance (k6) y revisión de índices/EXPLAIN en reportes.

## 6.7 i18n y documentación (opcional)

- i18n de plantillas email/SMS (es/en), Swagger, README/runbook y ADRs.

---

## Criterios de aceptación de la fase

1. Toda entidad clínica tiene `clinicId` no nulo y toda lectura lo respeta.
2. Adjuntos con validación de tipo/tamaño y almacenamiento abstraído.
3. Notificaciones SMS/WhatsApp con opt-in, idempotencia y reintentos.
4. Métricas y health cubren base de datos, colas, email, SMS y storage.
5. Cobertura mínima 55/45/40/55 y e2e de aislamiento multi-clínica.
6. Pipeline de CI/CD con migraciones automáticas y smoke post-deploy.
7. Documentación operativa actualizada (README, runbook y este plan).
