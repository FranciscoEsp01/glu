# Backend de Glu: credenciales, límites y consumo

Los clientes web y Mac solo usan la URL/clave pública de Supabase y el token de la cuenta. Gemini, Deepgram y Stripe se configuran como secretos de Edge Functions. No se solicitan credenciales de IA al usuario ni se incorporan al instalador.

## Límites iniciales

| Plan | Solicitudes de IA/mes | Tokens de IA/mes | Transcripción/mes |
|---|---:|---:|---:|
| Gratis | 0 | 0 | 0 |
| Pro | 100 | 2.000.000 | 300 minutos |
| Plus | 500 | 10.000.000 | 1.500 minutos |

Se mantienen las funciones locales gratuitas. Preguntas entre reuniones requieren Plus. Los períodos son meses naturales UTC; la cuota no se renueva al cancelar/reactivar ni al cambiar de plan. Los límites se definen en `supabase/functions/_shared/plans.ts`; las funciones SQL fijan máximos de seguridad. No son precios seleccionados en Stripe.

Además: máximo 10 operaciones/minuto por usuario, dos operaciones pendientes simultáneas, 256 KB por solicitud de IA y 8192 tokens máximos de salida. Las operaciones pendientes durante más de cinco minutos dejan de ocupar concurrencia, pero su reserva permanece consumida.

## Medición y autorización

Cada llamada verifica el JWT contra Supabase y reconcilia la suscripción con Stripe. Una reserva atómica en PostgreSQL comprueba plan, solicitudes, tokens, minutos y concurrencia antes de contactar al proveedor. Un `x-request-id` UUID identifica cada operación: repetirlo recupera el resultado guardado, devuelve estado en curso (202) o bloquea un resultado incierto; no vuelve a llamar al proveedor. Los reintentos explícitos con otro ID consumen cuota de nuevo.

`service_requests` registra usuario, función, estado, unidades reservadas, tokens reportados, estado HTTP del proveedor y fechas. El registro de consumo no almacena audio, transcripciones, prompts, secretos ni respuestas completas. La nueva tabla privada `service_results` conserva respuestas durante la ventana de recuperación de 24 horas, con limpieza programada al desplegar (ver `PROCESAMIENTO_FIABLE.md`). `service_consumption` agrega tokens/minutos por cuenta y mes. RLS permite al usuario leer sus filas; las escrituras y RPC quedan restringidas a service_role.

Gemini: se reserva el tamaño UTF-8 del prompt más 8192 tokens, una cota conservadora. Al terminar, `usageMetadata.totalTokenCount` sustituye esa reserva y también se registran prompt/candidates. El total reportado puede incluir pensamiento; no se suma de nuevo. Si falta medición, hay timeout, falla el proveedor o la función se interrumpe, se conserva la reserva completa. No se inventa consumo cero ni se reembolsa automáticamente una llamada cuyo resultado es incierto. Si falla el cierre del registro, el cliente recibe un error y la reserva continúa protegiendo la cuota.

Deepgram: el cliente convierte el audio a PCM mono de 16 bits/16 kHz. El servidor mide exactamente segundos por bytes (32.000 bytes/segundo), redondeando cada bloque hacia arriba. Los bloques duran hasta cinco minutos/9,6 MB y se procesan secuencialmente. Los minutos enviados consumen cuota aunque la respuesta falle. El audio original se conserva localmente ante fallos. No se aceptan URLs de audio arbitrarias ni duraciones declaradas por el cliente.

La aplicación muestra solicitudes, minutos y tokens en Plan y facturación. Son unidades de consumo; no se presenta un costo monetario calculado sin las tarifas reales del contrato de Glu. Para una auditoría, el operador puede consultar el ledger mediante acceso administrativo al servidor.

## Audio y límites prácticos

El cliente admite hasta 100 MB y dos horas para transcribir, y decodifica/remuestrea con Web Audio, también en Mac. Divide audios mayores. La conversión puede necesitar memoria considerable en grabaciones largas; falla conservando el original si el formato no puede decodificarse. La diarización es independiente por bloque, así que los hablantes se etiquetan con su bloque para evitar atribuir identidad entre segmentos. Los trabajos guardan cada bloque completado y lo omiten al reanudar. La petición interrumpida conserva su identificador para recuperar el resultado sin repetir consumo. Crear una operación nueva tras un fallo confirmado consume minutos nuevamente; ver `PROCESAMIENTO_FIABLE.md`.

## Activación en Supabase

Esta entrega añade código y migraciones; no implica que estén desplegados en tu proyecto remoto.

1. Autentica la CLI y vincula el proyecto:

```sh
supabase login
supabase link --project-ref pnqonvkpdpteqgplyelg
supabase db push
```

2. Completa `supabase/.env.local` siguiendo `.env.example`. Añade `DEEPGRAM_API_KEY`, además de Gemini y la configuración Stripe existente. Nunca uses variables `VITE_` para secretos. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los aporta el entorno alojado.
3. Ejecuta `npm run check:backend-env` para detectar variables faltantes sin mostrar secretos; después publica secretos y funciones:

```sh
supabase secrets set --env-file supabase/.env.local
supabase functions deploy billing
supabase functions deploy paid-ai
supabase functions deploy transcribe
supabase functions deploy stripe-webhook
```

4. Configura el webhook Stripe según `SUSCRIPCIONES.md`, los orígenes CORS de web/Mac, precios y portal. Prueba con Stripe en modo test: acceso válido, transcripción, consumo actualizado, agotamiento de cuota y pago fallido. Si falta un secreto o una migración, las funciones fallan cerradas y conservan los datos locales.

## Referencias

- https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded
- https://ai.google.dev/gemini-api/docs/tokens
- https://supabase.com/docs/guides/functions/secrets
