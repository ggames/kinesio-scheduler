# Fase 7 – Autogestión del paciente (Android) y facturación configurable

> **Objetivo**  
> Transformar el sistema en una herramienta operativa y comercial: el paciente puede gestionar sus turnos, ver su perfil, recibir recordatorios y facturas, mientras el equipo administrativo tiene control sobre coberturas, autorizaciones y cobros. La facturación puede operar como comprobante interno y, opcionalmente, integrarse con ARCA/AFIP para CAE/CAEA.

> **Estado previo**  
> - Fase 6 1 ya está implementada (auditoría/outbox por clínica, migración `Phase6ClinicScope`, 177 tests unitarios).  
> - Fases 6.2‑6.7 aún pendientes (ver `docs/fase-6.md`).  
> - El backend debe quedar consistente y depurado antes de iniciar el desarrollo de la app Android / web.

---

## 7.1 Catálogo público multi‑clínica
- **Objetivo:** Que la app Android descubra clínicas, profesionales y horarios sin sesión ADMIN.  
- **Trabajos:**  
  1. Exposiciones `@Public` en `GET /clinic`, `GET /professionals`, `GET /holiday`, `GET /time-slot/by-date` con filtro opcional `clinicId`.  
  2. Añadir `clinicId?` a `GET /professionals` y `GET /holiday` (mismo patrón que reports).  
  3. Exportar `GET /health-insurances` público (solo lectura) para la pantalla “obra social”.  
- **Aceptación:** La pantalla “Agenda” muestra lista de Kinesiólogos y Slots para la clínica seleccionada (por `clinicId` en `AsyncStorage` o “Clínica Principal” por defecto).

### Hecho ✅  (planificado, no código aún)

---

## 7.2 Flujo de sesión y refreshtoken en la app
- **Objetivo:** Evitar cierres inesperados cuando el JWT de 15 min expira.  
- **Trabajos:**  
  1. Implementar `/auth/refresh` en el interceptor `api.ts` y almacenar el `refresh_token` en `AsyncStorage`.  
  2. Agregar `setAuthToken` y `getAuthToken` para que el `AuthContext` re‑inicialice el token automáticamente.  
  3. Probar login + logout + renovación de sesión en dispositivo Android.  
- **Aceptación:** El token se renueva silenciosamente; el usuario sólo vuelve a ingresar credenciales cuando el refresh también caduca (máx. 30 días).

### Hecho ✅  (planificado, no código aún)

---

## 7.3 Perfil del paciente – mapeo de campos
- **Objetivo:** Que los datos `obraSocial` y `nroAfiliado` se persistan correctamente y aparezcan en el `profile` del usuario.  
- **Trabajos:**  
  1. Ajustar `Patient.entity` para que tenga `healthInsuranceId` + `healthInsurance` relation (ya existe) y, opcionalmente, columnas `obraSocial` y `nroAfiliado` como `nullable`.  
  2. Mapear en `authService.actualizarPerfil` y `AuthContext.actualizarPaciente` la transformación `obraSocial → healthInsuranceId` (lookup por nombre en `HealthInsurance`).  
  3. Actualizar `RegisterScreen` para que, al seleccionar una obra social, se guarde el `id` correspondiente en `healthInsuranceId`.  
- **Aceptación:** El `profile` del paciente muestra obra social y número de afiliado coherentes con la base de datos.

### Hecho ✅  (planificado, no código aún)

---

## 7.4 Solicitud de turnos por la app (autogestión)
- **Objetivo:** Permitir al paciente agendar, cancelar y reprogramar turnos desde la app.  
- **Trabajos:**  
  1. Endpoint `POST /appointments` ya usa `Idempotency-Key`; asegurar que el `patientId` corresponda al usuario autenticado.  
  2. Exponer `GET /appointments/my-appointments` con `clinicId` filtro (para que `findMyAppointments` solo devuelva los turnos de la clínica del usuario).  
  3. Agregar en la app la pantalla “Solicitar turno” que:  
     - Lista kinesiólogos (llamando `/professionals` público).  
     - Permite elegir fecha y horario (usando `/time-slot/by-date`).  
     - Pide notas opcionales.  
     - Devuelve appointment id y programa notificación de confirmación.  
  4. Implementar `POST /appointments/:id/cancel` con ventana `CANCELLATION_WINDOW_HOURS` (24 h por defecto) y notificación `appointment_cancelled`.  
- **Aceptación:** Un paciente puede abrir la app → ver próximos turnos → cancelar o res programar un nuevo turno sin necesitar acceso ADMIN.

### Hecho ✅  (planificado, no código aún)

---

## 7.5 Facturación configurable (comprobante interno + opcional ARCA/AFIP)
- **Objetivo:** El sistema pueda emitir facturas internas y, si está activado, integrarse con ARCA (antes AFIP) para CAE y CAEA.  
- **Trabajos:**  
  1. Crear entidades `Invoice`, `InvoiceItem`, `Payment` y `Receipt` (con `clinicId` opcional y `status: ISSUED/PAID/CANCELLED`).  
  2. Agregar `POST /invoices` (y `GET /invoices`) con `@ClinicScope()` para `ADMIN` /`CLINIC_ADMIN`.  
  3. Bandera `ENABLE_INVOICING` en `.env` ; cuando `true` exponer `GET /invoices/cae` y `POST /invoices/:id/cancel` con validación de CUIT y certificados opcionales.  
  4. Mantener `GET /metrics` financieros (revenue, pending, outstanding) incluyendo `clinicId`.  
  5. Tests unitarios +e2e de flujo de cre‑pago‑reembolso con idempotencia.  
- **Aceptación:** El médico o personal de administración puede emitir una factura desde el panel admin ; el botón “Facturar” aparece solo cuando `ENABLE_INVOICING=true`. Si está `false`, solo se guarda un comprobante  interno (PDF genérico) sin integración fiscal.

### Hecho ✅  (planificado, no código aún)

---

## 7.6 Notificaciones y recordatorios
- **Objetivo:** El paciente reciba push/email cuando falta menos 24 h para su turno y al cancelarse.  
- **Trabajos:**  
  1. Ya existe `NotificationPreferencesController` y `enqueueAppointmentEmail` ; integrar `expo‑push` (o FCM) para dispositivos Android.  
  2. Agregar `/notifications/preferences` para que el usuario marque `appointmentReminders` y `appointmentChanges`.  
  3. Programar cron cada 15 min que busque turnos `SCHEDULED` con `startTime` entre ahora y ahora + 24 h y encolé email /SMS.  
- **Aceptación:** El usuario recibe una notificación 24 h antes del turno y otra al cancelarse.

### Hecho ✅  (planificado, no código aún)

---

## 7.7 Calidad y operación
- **Objetivo:** Cobertura ≥ 55/45/40/55 (y nueva meta para módulos 7), e2e de autogestión y facturación, CI con migraciones y smoke post‑deploy.  
- **Trabajos:**  
  1. Actualizar `jest.config.ts` cobertura a 55/45/40/55.  
  2. Añadir e2e para login → agendar turno → cancelar → ver factura (aislamiento por clínica).  
  2. Contratos OpenAPI (y Swagger habilitado solo en dev).  
  3. Docker multi‑stage + `docker‑compose` para entornos de prueba y producción.  
  4. Smoke de performance (k6) y revisión de índices/EXPLAIN en reportes.  

### Hecho ✅  (planificado, no código aún)

---

## Próximos pasos
1. **Crear `docs/fase-7.md`** con este plan (hecho arriba).  
2. **Implementar 6.2 – 6.7** en el backend (ver sección “Implementación” más abajo).  
3. Una vez el backend esté completo, consistente y depurado, dar pase al desarrollo de la app Android / web.

--- 

### Implementación (próximos commits)

#### 6.2 Adjuntos de producción
- Sustituir base64 por `multipart/form-data` (`FileInterceptor`), descarga en streaming (`StreamableFile`), límite 10 MB y allowlist MIME.  
- `StorageProvider` abstracto (local/S3), URLs firmadas, checksum SHA‑256 y hook antivirus.  
- Migración: `checksum`, `storageKey`, `deletedAt`; borrado lógico.  
- Tests unitarios + e2e de subida/descarga/permisos.

#### 6.3 SMS/WhatsApp y recordatorios
- Proveedor real (Twilio o WhatsApp Cloud API) detrás de `SMS_PROVIDER`; en desarrollo se mantiene `LogSmsProvider`.  
- Preferencias de canal (`email`/`sms`/`whatsapp`) con opt‑in y consentimiento.  
- Cron de recordatorio T‑24 h con idempotencia, reintentos y plantillas.  
- Métricas y auditoría de envíos.  
- **Aceptación:** un recordatorio por turno; fallo del proveedor reintenta sin bloquear el flujo principal.

#### 6.4 Observabilidad y operación
- Health extendido: SMTP, SMS y storage; readiness de outbox y jobs.  
- Métricas de negocio: outbox pendiente/fallida, recordatorios, adjuntos; alertas asociadas.  
- Outbox DLQ + reintento manual; purga programada de tokens, outbox e idempotency.  
- `requestId` propagado a jobs y tareas programadas.

#### 6.5 Seguridad y cumplimiento
- Revisión OWASP: uploads, rate‑limit por usuario/IP, CORS, rotación de secretos y HMAC.  
- Retención/anonimización de PII y export legal (módulo privacy).  
- Backup/restore documentado y runbook de incidentes; `npm audit` a 0 high/moderate.

#### 6.6 Calidad y CI/CD
- Cobertura a 55/45/40/55.  
- E2E completos: reset password, portal paciente, `/notifications/mine`, adjuntos multipart y aislamiento multi‑clínica.  
- Contract tests OpenAPI, smoke de migraciones y CI Node 20/22 (CodeQL ya existe).  
- Docker multi‑stage + compose prod‑like + pipeline de deploy con `migration:run:prod`.  
- Smoke de performance (k6) y revisión de índices/EXPLAIN en reportes.

#### 6.7 i18n y documentación (opcional)
- i18n de plantillas email/SMS (es / en), Swagger, README/runbook y ADRs.

> **Nota:** Los items 6.2 a 6.7 de Fase 6 se completan previamente para asegurar un backend robusto, consistente y con tests antes de iniciar la Fase 7.