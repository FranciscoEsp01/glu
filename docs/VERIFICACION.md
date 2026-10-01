# Verificación de Glu 0.3.0

Fecha: 30 de septiembre de 2026.

## Verificado

- TypeScript estricto y build de producción Vite.
- Diez pruebas unitarias de validación de salida de IA, transcripción vacía, escape de HTML y exportación.
- Once pruebas de navegador: importación, persistencia, edición, tareas, error de API, permisos denegados, pausa real, recuperación de audio, eliminación tras éxito y conservación ante fallo de almacenamiento.
- Las pruebas de navegador usan un dispositivo de audio artificial y respuestas HTTP controladas. No afirman precisión de transcripción ni consumen API reales.
- Compilación Swift de ScreenCaptureKit y compilación Rust/Tauri para Apple Silicon.
- Mezcla y recuperación nativa con dos archivos CAF de prueba: salida WAV de 96.000 muestras a 48 kHz; ambas señales preservadas.
- Inicio de la aplicación empaquetada en macOS, visualización del contenido y transición a ventana compacta / historial.
- Dependencias del editor actualizadas a TipTap 3.31.4; instalación completada con cero vulnerabilidades reportadas por npm.

## Requiere validación con el propietario

- Permisos reales de micrófono y captura de audio del sistema, llamada real y cambios de dispositivo (AirPods/Bluetooth).
- Credenciales activas de Deepgram y Gemini para una prueba completa contra los proveedores.
- Duración prolongada, suspensión del equipo, reconexiones y diferentes dispositivos de audio.
- Firma Developer ID y notarización para distribuir fuera de este equipo.

## Alcance pendiente del negocio

El flujo individual está implementado. Aún no están implementadas las cuentas multiusuario, suscripciones, facturación, sincronización de equipos, OAuth de calendarios, OAuth público de Slack/Notion, integración CRM, búsqueda vectorial entre reuniones, cifrado de SQLite, captura nativa Windows ni actualizaciones firmadas. No se presentan botones de integración ficticios ni promesas de retención cero de proveedores.

La ampliación incluye pruebas de citas exactas, recuperación del historial, previsualización antes de enviar y temporizador resistente a retrasos del navegador. Slack/Notion y preguntas a Gemini se validaron con respuestas controladas; no se enviaron mensajes reales.


## Actualización: acceso de usuarios (1 de octubre de 2026)

- Supabase Auth con código por correo, verificación remota de sesión, cierre y vencimiento de sesión.
- Datos locales separados por cuenta: historial, audio, ajustes y credenciales de proveedores.
- Build web correcto y 10 pruebas unitarias aprobadas.
- 11 pruebas existentes de flujos aprobadas con sesión autenticada controlada; 5 pruebas nuevas de acceso aprobadas (código inválido/válido y cierre, cambio de cuenta, sesión rechazada, fallo de red y vencimiento).
- Vista de acceso inspeccionada mediante captura de navegador.
- No se verificó envío real de correo: falta configurar el proyecto Supabase/SMTP del propietario.
- No se verificó la compilación nativa de estos cambios: Cargo no está instalado en este entorno. Las validaciones nativas anteriores de este documento corresponden a la versión previa al login.
- Las cuentas no incluyen sincronización ni equipos; véase `AUTENTICACION.md` para configuración, migración del historial previo y límites de la separación local.


## Actualización: suscripciones (1 de octubre de 2026)

- Integración Stripe Checkout/Portal, cancelación al vencimiento y reactivación; estados de impago y control de acceso real en Edge Functions.
- IA de resúmenes y preguntas trasladada al backend con cuotas por usuario; el acceso a notas/historial/exportaciones permanece disponible sin plan pagado.
- 22 pruebas de lógica y backend aprobadas: incluyen firmas del SDK de Stripe, reconciliación de eventos duplicados/antiguos, compra duplicada, cancelación por propietario, recuperación de pagos, denegación de IA y cuotas. La migración, permisos RLS y funciones atómicas se ejecutaron sobre PostgreSQL embebido (PGlite).
- 20 pruebas de navegador aprobadas entre los flujos existentes y los cuatro nuevos casos de facturación. Se corrigió una superposición que impedía pulsar Gestionar pagos ante un pago fallido.
- Comprobación TypeScript del backend (`npm run check:billing`) y build web correctos. Vista de facturación inspeccionada mediante captura.
- Pendientes externos: despliegue Supabase, configuración Stripe/SMTP, prueba real en Stripe test y compilación nativa (Cargo no está instalado). No se realizaron cobros reales. Las pruebas de pagos usan respuestas controladas; no certifican operación en producción.


## Entrega macOS 0.4.0 (1 de octubre de 2026)

- Se encontró el toolchain Rust instalado en `/private/tmp/glu-cargo` y `/private/tmp/glu-rustup`; no figuraba en el PATH. Queda resuelta la verificación nativa pendiente de las secciones anteriores.
- Compilación Rust/Swift/Tauri en modo release correcta para Apple Silicon, macOS 15+.
- Aplicación actualizada en `release/Glu.app` e instalador `release/Glu_0.4.0_aarch64.dmg`.
- Versión anterior preservada en `release/archive/Glu-0.3.0.app`.
- Firma ad hoc del bundle validada con `codesign --verify --deep --strict`. Imagen de disco validada con `hdiutil verify`.
- Inicio de la aplicación nativa y pantalla de acceso comprobados mediante accesibilidad de macOS (`tauri://localhost`).
- El paquete incluye login y facturación, pero el acceso muestra configuración pendiente: no hay URL/clave pública Supabase configuradas en este workspace. No se validaron correos, Keychain con una sesión real ni cobros Stripe reales. Se requiere recompilar tras configurar `.env.local` y activar el backend.
- El paquete tiene firma local; no cuenta con Developer ID ni notarización pública. Véase `MACOS.md`.
