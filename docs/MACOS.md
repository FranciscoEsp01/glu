# Glu para macOS — versión 0.7.0

La versión 0.7.0 añade una cola persistente por cuenta con recuperación y estados visibles (ver `PROCESAMIENTO_FIABLE.md`), y utiliza las credenciales de Gemini y Deepgram de Glu en el servidor y muestra las cuotas de consumo. Para activarlas, consulta `BACKEND_CONSUMO.md`.

Esta versión incluye el acceso Supabase con Google (ver `GOOGLE_AUTH.md`) y por código de correo y Plan y facturación con Stripe. Comparte el frontend y las comprobaciones de servidor con la versión web.

La entrega 0.7.0 incorpora la configuración pública de Supabase de `.env.local`, que faltaba en el paquete 0.4.0. Cambiar ese archivo exige volver a compilar e instalar la app.

## Uso

Abre `release/Glu-0.8.0.app` o instala desde `release/Glu_0.8.0_aarch64.dmg`. Requiere un Mac con Apple Silicon y macOS 15 o posterior. La versión anterior se conserva en `release/archive/`.

El login debe estar configurado antes de compilar:

1. Copia `.env.example` a `.env.local` y configura la URL y clave **pública** Supabase.
2. Configura los códigos de correo siguiendo `AUTENTICACION.md`.
3. Despliega las funciones y configura los secretos de Stripe/Gemini en el servidor, según `SUSCRIPCIONES.md`. Nunca incluyas esos secretos en el bundle de Mac.
4. Compila nuevamente. Vite incorpora la configuración pública al build; editar `.env.local` después no modifica una app ya empaquetada.

Sin esta configuración, la aplicación muestra el acceso no disponible; no contiene cuentas falsas ni un acceso alternativo. El historial antiguo permanece en su ubicación original y no se asigna automáticamente a un usuario.

## Integración nativa

- Tokens de sesión en Keychain, con renovación gestionada por Supabase.
- SQLite, audios y credenciales personales separados por cuenta.
- Checkout y portal Stripe se abren en el navegador del sistema. El comando nativo permite únicamente HTTPS a `checkout.stripe.com` y `billing.stripe.com`.
- La pantalla de facturación actualiza el estado al volver a Glu y permite actualización manual.
- Los permisos de IA y cuotas se verifican en las Edge Functions, también para solicitudes desde Mac.
- El historial, notas y exportaciones siguen siendo locales.

## Compilar

Necesitas Node, Rust estable y las herramientas de Xcode.

```sh
npm ci
npm run build:mac
```

Tauri deja los resultados en `src-tauri/target/release/bundle/`, o bajo `CARGO_TARGET_DIR` cuando se configura. Copia la aplicación y el DMG a `release/` tras verificar el build.

La configuración usa firma **ad hoc** (`signingIdentity: "-"`) para sellar el paquete local. No es firma Developer ID ni notarización. Antes de distribuir públicamente, reemplaza la identidad por tu certificado de Apple y configura la notarización. No hace falta desactivar Gatekeeper para compilar.

## Validación

Comprueba la versión y el sello del paquete:

```sh
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' release/Glu-0.8.0.app/Contents/Info.plist
codesign --verify --deep --strict release/Glu-0.8.0.app
hdiutil verify release/Glu_0.8.0_aarch64.dmg
```

La compilación de esta entrega utiliza el toolchain existente en `/private/tmp/glu-cargo` y `/private/tmp/glu-rustup`, que no estaba en el PATH normal, y la caché de build nativo anterior. No dependas de esas carpetas temporales para futuras compilaciones; configura Rust en tu entorno habitual.

## Preparación comercial de 0.8.0

Incluye el panel de operaciones para cuentas autorizadas y el aviso de pagos de pruebas. Ejecuta `npm run check:mac-release` para comprobar los requisitos de firma y notarización. Con un DMG previamente firmado con Developer ID, `GLU_NOTARY_PROFILE=perfil node scripts/notarize-mac.mjs ruta/Glu.dmg` envía, adjunta y valida el ticket. El actualizador firmado permanece pendiente. Consulta [Estado de lanzamiento](LANZAMIENTO_SAAS.md).
