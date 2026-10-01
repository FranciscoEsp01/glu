# Acceso de usuarios

Glu usa Supabase Auth con códigos por correo: el mismo flujo permite crear una cuenta o acceder a una existente. No hay usuarios de prueba ni acceso alternativo en producción. Sin configuración se muestra la pantalla de acceso bloqueada.

## Activar

1. Crea un proyecto Supabase y habilita Email en Authentication / Providers. Permite nuevos registros si quieres que cualquier usuario pueda crear su cuenta.
2. Copia `.env.example` a `.env.local`. Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con la URL y clave pública del proyecto. Nunca uses una clave secret o service_role. Reinicia Vite; recompila Tauri para distribuir los cambios.
3. En Authentication / Email Templates / Magic Link, usa un código en lugar de un enlace: `<p>Tu código de acceso a Glu es: <strong>{{ .Token }}</strong></p>`. El formulario admite códigos de 6 a 10 dígitos según la configuración del proveedor.
4. Configura SMTP propio para enviar a usuarios externos y ajusta límites de envío/expiración en Supabase. El correo de desarrollo del proveedor tiene restricciones; comprueba la entrega real antes de lanzar.
5. Ejecuta `npm run dev`. Solicita un código, introdúcelo y verifica que cerrar sesión vuelve al acceso. En macOS puede solicitarse permiso para acceder a Keychain.

Si utilizas un dominio personalizado para Auth, añade ese origen exacto a `connect-src` en `src-tauri/tauri.conf.json`. La configuración inicial permite HTTPS a proyectos `*.supabase.co`.

## Sesión y datos

- La sesión se verifica contra Supabase con `getUser` antes de abrir el historial. El SDK renueva los tokens automáticamente. Se necesita conexión para validar el acceso al iniciar.
- Web guarda la sesión en sessionStorage (por pestaña); escritorio en Keychain. No se guardan contraseñas. El cierre revoca la sesión actual; no cierra otros dispositivos.
- Cada cuenta tiene claves de metadatos, base de audio y ajustes independientes en web. En escritorio se usa `accounts/<user-id>/glu.sqlite`, `accounts/<user-id>/recordings/` y credenciales de proveedores separadas en Keychain.
- El historial previo sin cuenta permanece intacto en su ubicación anterior y no se asigna automáticamente. Para migrarlo, exporta una copia JSON desde la versión anterior y restáurala en la cuenta correcta; el JSON no incluye audios ni claves.
- No se permite cerrar sesión desde el botón durante una grabación o procesamiento. Si el proveedor finaliza una sesión, se oculta el contenido y se permite finalizar/guardar antes de volver al acceso.
- La separación local evita mezclar cuentas en la interfaz. No cifra el disco ni constituye autorización de servidor: una persona con acceso a los archivos o al runtime local puede leerlos. Al agregar sincronización será obligatorio validar tokens y permisos en el backend/RLS.
- Esta integración no crea una base de reuniones en Supabase ni sincroniza contenido. La cuenta es remota; las reuniones siguen siendo locales.

## Validación

`npm test`, `npm run build`, `npm run test:e2e` y `cargo check --manifest-path src-tauri/Cargo.toml`.
Las pruebas e2e usan respuestas Auth controladas; no envían correos reales. La entrega SMTP y el flujo completo con el proyecto del propietario requieren credenciales públicas configuradas y una cuenta de correo real.

Referencias: https://supabase.com/docs/guides/auth/auth-email-passwordless y https://supabase.com/docs/reference/javascript/auth-getuser
