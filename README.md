# Glu

Aplicación de reuniones con captura de audio, apuntes, transcripción con Deepgram y resúmenes con Gemini. Los resultados provienen de las APIs: no hay transcripciones, acuerdos ni tareas simuladas en el flujo de uso.

## Ejecutar

```sh
npm install
npm run dev
```

Abre http://localhost:1420. Para escritorio necesitas Node 22+, Rust estable y las herramientas de línea de comandos de Xcode:

```sh
npm run tauri dev
npm run tauri build -- --bundles app
```

La captura nativa requiere **macOS 15 o posterior** y permisos de micrófono y grabación de pantalla/audio. Se compila un auxiliar Swift usando ScreenCaptureKit; no se guardan imágenes de la pantalla. El build admite Apple Silicon e Intel según el target de compilación. La compilación verificada en este equipo es Apple Silicon. Windows no tiene todavía motor de captura nativo; la versión web permite usar micrófono y, cuando el navegador lo permita, compartir audio de una pestaña.

## Versión macOS 0.6.0

La app actualizada está en `release/Glu-0.6.0.app` y el instalador Apple Silicon en `release/Glu_0.6.0_aarch64.dmg`. Incluyen login, facturación y consumo gestionado por el backend. Consulta [macOS](docs/MACOS.md) para configurar los servicios, recompilar y conocer el alcance de la firma local.

## Acceso de usuarios

El acceso usa Supabase Auth con código por correo. Configura `.env.local` y la plantilla de correo siguiendo [Autenticación](docs/AUTENTICACION.md). Sin configuración no se abre el historial. Cada cuenta tiene historial, audios y credenciales locales separados; esta integración no sincroniza reuniones con la nube. El historial previo permanece intacto sin asignarse automáticamente.

## Suscripciones

Glu incluye planes Gratis, Pro y Plus con Stripe Checkout, portal de pagos, cancelación al final del período y manejo de pagos fallidos. Los resúmenes (Pro/Plus) y preguntas (Plus) pasan por Edge Functions con validación del plan y cuotas en servidor. Antes de activarlo, configura y despliega la base de datos y las funciones siguiendo [Suscripciones](docs/SUSCRIPCIONES.md). No se realizan cobros hasta configurar Stripe. Transcripción, resúmenes y preguntas usan credenciales de Glu en el backend, con cuotas de minutos, solicitudes y tokens. Consulta [Backend y consumo](docs/BACKEND_CONSUMO.md).

## Primer uso

1. Inicia sesión con tu correo y el código recibido. Activa Pro o Plus para transcribir con las credenciales de Glu. Para generar resúmenes, activa Pro o Plus desde Plan y facturación; Gemini se configura en el servidor.
2. Elige micrófono o micrófono + sistema/pestaña, idioma y conservación de audio.
3. Crea una reunión, informa a sus participantes y concede los permisos del sistema.
4. Toma apuntes desde la cápsula. Pausar detiene ambas fuentes; finalizar guarda la reunión antes de llamar a los proveedores.
5. Revisa el resumen, marca tareas, edita las notas, copia el contenido o descarga Markdown.

También puedes pegar una transcripción o importar audio (para transcribir, hasta 100 MB y dos horas) sin claves. La generación de resúmenes requiere un plan Pro o Plus activo y el backend configurado; la transcripción de audio requiere Deepgram. En navegador, la captura dual exige seleccionar una fuente con audio compartido. Si no está disponible, Glu muestra un error y libera los dispositivos.

## Funciones implementadas

- Captura real de micrófono en navegador y captura nativa micrófono/sistema con ScreenCaptureKit en macOS 15+.
- Pausa real, temporizador, apuntes y ventana compacta siempre visible en escritorio.
- Transcripción al finalizar (no streaming en vivo), con tiempos y etiquetas de hablantes.
- Resúmenes por plantilla, tareas y decisiones con validación de estructura; nunca se inventa un fallback cuando falla una API.
- Historial, búsqueda textual, destacados, editor TipTap, tareas, importación y eliminación con confirmación.
- Audio reproducible y descargable, navegación desde marcas de tiempo y exportación Markdown/copia para otras herramientas.
- SQLite en escritorio; localStorage para metadatos e IndexedDB para audio en web.
- Recuperación de reuniones interrumpidas y reintentos sin perder la transcripción.
- Preguntas sobre el historial: recuperación local por palabras clave y respuestas Gemini con citas textuales verificadas.
- Copias JSON del historial y restauración sin sobrescribir reuniones existentes (sin audios ni claves).
- Envío real a Slack y Notion desde escritorio, con vista previa, destino explícito y credenciales en Keychain.
- Tema claro/oscuro/sistema. Atajos de escritorio: ⌘⇧R, ⌘⇧N, ⌘⇧M; ⌘K dentro de Glu.

## Datos y privacidad

En escritorio, las claves personales de integraciones se guardan en Keychain y sus peticiones se realizan desde Rust. La transcripción usa la clave de Glu desde el backend. Los resúmenes y las preguntas usan Gemini desde el servidor, con validación de suscripción. En navegador solo permanecen en memoria durante la sesión. No se incluyen secretos en el repositorio.

El audio se envía a Deepgram y el texto a Google Gemini cuando procesas una reunión. Sus políticas y la configuración de tu cuenta aplican; Glu no afirma que los proveedores tengan retención cero. El historial local no está cifrado por esta versión; la protección del disco depende del sistema operativo.

En macOS los archivos residen en `~/Library/Application Support/com.glu.meetingai/`. Cada cuenta usa `accounts/<user-id>/`: SQLite guarda su historial y `recordings/<id>/` conserva audio y fragmentos recuperables. Los fragmentos CAF se mezclan a WAV al finalizar. En web se escriben checkpoints cada 5 segundos; un cierre abrupto puede perder el último intervalo y la recuperación depende del formato soportado por el navegador.

Si desactivas conservar audio, se elimina solo después de generar y guardar el resumen con éxito. Mientras exista un error, el audio se conserva para reintentar. Cambiar esta opción no borra retroactivamente otras reuniones: puedes eliminarlas desde su vista.

## Validación

```sh
npm run build
npm test
npx playwright install chromium
npm run test:e2e
cargo check --manifest-path src-tauri/Cargo.toml
```

Para usar un navegador Chromium instalado, define `PLAYWRIGHT_EXECUTABLE_PATH`. Las pruebas e2e utilizan audio de prueba y respuestas HTTP controladas; no consumen saldo ni prueban la precisión de un proveedor real.

## Estado y límites

Esta es una implementación funcional del flujo individual, no un SaaS comercial terminado. Requiere pruebas de una llamada real con permisos y credenciales del propietario antes de distribuirse a usuarios. La firma Developer ID y notarización no están configuradas.

Pendientes de la visión de negocio: equipos, sincronización, OAuth de calendarios, OAuth de Slack/Notion, integración CRM, búsqueda vectorial entre reuniones, cifrado de la base local, Windows nativo y actualización automática firmada. Slack y Notion usan tokens configurados por el usuario, no un flujo OAuth público.

## Referencias técnicas

- [Tauri v2](https://v2.tauri.app/)
- [ScreenCaptureKit — Apple](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos)
- [Deepgram — audio pregrabado](https://developers.deepgram.com/docs/pre-recorded-audio)
- [Gemini — salida estructurada](https://ai.google.dev/gemini-api/docs/structured-output)

## Slack, Notion y memoria de reuniones

En Configuración, despliega «Conectar Slack y Notion». Slack requiere un token de bot con `chat:write` y acceso al canal indicado. Notion requiere un token de integración con permiso para insertar contenido y una página compartida con esa integración; Glu crea una página hija bajo la página de destino. Acepta su ID o enlace.

Los botones Slack y Notion muestran el contenido exacto antes de enviarlo. No incluyen el audio ni la transcripción completa. No hay reintentos automáticos de escrituras: si se pierde la conexión, revisa el destino para evitar duplicados. Las rutas están implementadas y probadas con servicios controlados; debes validarlas con tus propias cuentas.

«Preguntar a mis reuniones» encuentra fragmentos por coincidencias de palabras en el dispositivo. Al pulsar Responder, el servidor comprueba el plan Plus y envía la pregunta y hasta ocho fragmentos a Gemini. La respuesta solo se muestra con citas que coincidan literalmente con las fuentes. Esta versión no usa embeddings; preguntas sin términos relacionados pueden no encontrar evidencia.

«Copias del historial» exporta notas y transcripciones en JSON. No incluye audio, ajustes ni credenciales. Al restaurar, los IDs ya existentes conservan su contenido actual. Guarda los audios por separado si quieres conservarlos fuera de Glu.

Referencias de integración: [Slack chat.postMessage](https://docs.slack.dev/reference/methods/chat.postMessage/) y [límites de Notion](https://developers.notion.com/reference/request-limits).
