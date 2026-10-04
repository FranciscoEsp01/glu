# Glu 0.8.0 · estado de lanzamiento

Verificación del 4 de octubre de 2026. La preparación técnica ha avanzado; el lanzamiento comercial sigue pendiente.

## Desplegado en Supabase

Proyecto `pnqonvkpdpteqgplyelg`:

- Cuatro migraciones instaladas y registradas: facturación, consumo, procesamiento persistente y operaciones. Todas las tablas públicas de Glu tienen RLS y permisos restringidos.
- Seis funciones publicadas: `billing`, `stripe-webhook`, `paid-ai`, `transcribe`, `health`, `operations-admin`.
- Las funciones de cuenta verifican la sesión con Supabase Auth. El webhook verifica la firma de Stripe sobre el cuerpo original. `health` es público y no devuelve secretos, identidades ni contenido.
- Claves de Gemini y Stripe de pruebas, secreto del webhook y configuración de facturación cargados en el almacén de secretos con autorización del propietario.
- Limpieza de resultados expirados una vez por hora; actualización de avisos cada cinco minutos. Se comprobaron ejecuciones reales con estado `succeeded`.
- La cuenta administradora indicada por el propietario tiene acceso al panel «Operaciones y consumo». Las cuentas normales no pueden concederse este permiso ni llamar los RPC administrativos.

El panel muestra hasta 100 cuentas del mes UTC, 50 operaciones recientes, consumo y alertas de interrupciones o fallos repetidos. Nunca muestra transcripciones o respuestas de IA. Los planes reflejan la última conciliación guardada con Stripe. «Marcar revisado» registra una revisión por 30 minutos; no corrige una operación fallida.

Para estimar costes, cargar tarifas contractuales actuales en los secretos opcionales `GEMINI_INPUT_USD_PER_MILLION`, `GEMINI_OUTPUT_USD_PER_MILLION` y `DEEPGRAM_USD_PER_MINUTE`. Hasta entonces el panel indica «Tarifas no configuradas». La estimación es parcial y no representa una factura.

## Stripe

El catálogo **de pruebas** está creado y verificado por API: Pro 15 USD/mes, Plus 25 USD/mes. El portal permite actualizar el medio de pago, consultar facturas y cancelar al término del período. El webhook de pruebas apunta al backend de Glu y se verificó una entrega firmada de sondeo sin clientes ni pagos. El formulario de planes identifica el modo de pruebas cuando el servidor lo informa.

No se han activado cobros reales. La cuenta consultada no tiene cobros ni transferencias habilitados. El catálogo y los secretos de prueba no se convierten automáticamente en configuración live.

Antes de cobrar: confirmar la entidad y país de la cuenta; completar la verificación comercial y bancaria en Stripe; crear los precios, portal y webhook en live; guardar las claves live en Supabase; comprobar un pago, renovación, cancelación, fallo y recuperación con el propietario. El `BILLING_RETURN_URL` actual es local y debe sustituirse por una página HTTPS publicada antes de distribuir a clientes.

## Verificaciones y herramientas

```sh
npm run check:billing
npm test
npm run test:e2e
npm run build
npm run smoke:backend
npm run check:mac-release
npm run bundle:backend
```

`smoke:backend` realiza sondeos remotos sin imprimir credenciales. Comprueba Auth, readiness, rechazo anónimo, firma del webhook de pruebas, catálogo/portal Stripe y disponibilidad del listado de modelos Gemini. Guarda `release/backend-readiness.json`. Sale con error cuando falta configuración; eso no debe ocultarse en CI. No valida una generación real, precisión de transcripción, saldo ni el ciclo completo de pago.

Readiness comprobada: base de datos presente; configuración de facturación y Gemini presente; transcripción pendiente por falta de `DEEPGRAM_API_KEY`. Los cuatro endpoints de cuenta rechazaron solicitudes anónimas con 401, y el webhook sin firma con 400. Un sondeo firmado y sin efecto de facturación fue aceptado con 200.

La CI está preparada en `.github/workflows/ci.yml`: tipos, pruebas, navegador y build. El despliegue manual de backend está en `backend.yml`, con entorno `production`. Estos archivos requieren subir el repositorio y configurar allí `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` y la variable `SUPABASE_PROJECT_REF`; no están activos remotamente por el mero hecho de existir aquí. Las claves de proveedores se administran en Supabase y no se incluyen en el repositorio.

`bundle:backend` genera archivos individuales sin secretos en `release/backend` para el editor del Dashboard. Los bundles de `health` y `operations-admin` publicados inicialmente se introdujeron con formato compacto equivalente al código fuente; los demás se copiaron desde estos bundles.

## Web y soporte

`public/producto.html` contiene presentación y planes; `public/ayuda.html`, ayuda de acceso, datos locales, cuotas, trabajos y facturación. Se revisaron en escritorio y móvil. Se incluyen en el build de Vite, pero no están publicados en un dominio externo.

No se inventó una entidad, dominio ni correo de soporte. Los textos legales de `docs/legal/` son borradores internos con los datos y decisiones que faltan; no se han publicado como políticas vinculantes. Completar responsable, contacto, jurisdicción, retención del registro operativo, eliminación de cuenta, reembolsos y revisión antes de pedir aceptación a clientes.

## Mac

Instalador local: `release/Glu_0.8.0_aarch64.dmg`, para Apple Silicon y macOS 15 o posterior. Incluye login, planes, trabajos persistentes, consumo y panel de operador. El paquete y el DMG se verifican con `codesign` y `hdiutil`.

La firma actual es ad hoc. No hay certificado Developer ID ni perfil de notarización disponible. `check:mac-release` informa esos pendientes; `scripts/notarize-mac.mjs` prepara el envío y validación de un DMG ya firmado, usando un perfil de Keychain del propietario. No reemplaza la firma Developer ID. Consultar el [procedimiento de Apple](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).

El actualizador automático firmado continúa pendiente: requiere claves de actualización, un canal HTTPS de publicación y el flujo de firma. No está implementado ni se presenta como operativo.

## Límites y pendientes

- Falta Deepgram y una prueba de audio real.
- Falta activación comercial de Stripe, configuración live y ciclo real de pago.
- Faltan dominio, hosting, correo de soporte y datos legales, que el propietario aún no tiene definidos.
- Faltan Developer ID, notarización y actualizaciones firmadas para distribución pública.
- El procesamiento persistente requiere Glu abierto; no es un worker autónomo en la nube. Ese cambio requiere almacenamiento de entrada, retención, un worker y sus pruebas de recuperación.
- No hay sincronización del historial entre equipos. Respaldos/restauración del backend, recuperación tras desastre y avisos externos de disponibilidad deben concretarse antes de prometer un SLA.

Referencias de despliegue: [Supabase Dashboard](https://supabase.com/docs/guides/functions/quickstart-dashboard) y [GitHub Actions](https://supabase.com/docs/guides/functions/examples/github-actions).

Se abrió Glu 0.8.0 en Mac y se comprobó una sesión real restaurada. La cuenta autorizada consultó el panel operativo del backend desplegado sin errores. La facturación mostró los precios del catálogo de Stripe de pruebas; no se inició ningún pago.

También se verificó en la aplicación de Mac que la respuesta del backend muestra el aviso de Stripe en modo de pruebas. La cuenta `espinozafrancisco.v@gmail.com` tiene el permiso de operador autorizado para consultar consumo y estados, sin contenido de reuniones.
