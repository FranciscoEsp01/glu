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
