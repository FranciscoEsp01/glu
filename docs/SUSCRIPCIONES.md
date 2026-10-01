# Suscripciones con Stripe

## Qué está implementado

- Checkout alojado en Stripe para contratar Pro o Plus; precios mensuales obtenidos del servidor desde Stripe, sin importes inventados en la interfaz.
- Portal de Stripe para actualizar tarjetas, consultar facturas, pagar importes pendientes y cambiar de plan.
- Cancelación al final del período, con confirmación en Glu; reactivación de la renovación antes del vencimiento.
- Detección de pagos fallidos, suspensión del acceso premium y recuperación cuando Stripe confirma una suscripción vigente.
- Reconciliación con el estado actual de Stripe ante eventos y consultas. Un evento antiguo no puede restaurar permisos revocados.
- Webhook con firma verificada, tolerancia de tiempo del SDK y registro idempotente. Una caída de Stripe o de la base devuelve error para permitir reintentos.
- Autenticación Supabase comprobada en cada operación. Los clientes nunca eligen un customer/subscription ID, importe, price ID ni URL de retorno.
- RLS de solo lectura para los datos propios. Escrituras, bloqueos de concurrencia y cuotas quedan reservados a service_role.

El código está integrado, pero **no cobra ni opera contra una cuenta Stripe real hasta configurar y desplegar el backend**. No se han creado productos, enviado facturas ni realizado pagos reales durante el desarrollo.

## Planes iniciales y política de acceso

| Plan | Incluye | Cuota de IA |
|---|---|---|
| Gratis | Grabación, notas, historial local, importación, exportaciones y conexiones locales existentes | Sin IA gestionada |
| Pro | Gratis + resúmenes con IA | 100 solicitudes al mes |
| Plus | Pro + preguntas sobre el historial | 500 solicitudes al mes en total |

La transcripción de audio sigue utilizando la clave **personal de Deepgram**. No está incluida en el precio del plan ni se factura desde Glu. La IA de resúmenes y preguntas usa una clave Gemini del servidor y ya no llama directamente desde el cliente. Los campos/secretos Gemini históricos se conservan por compatibilidad, pero no habilitan acceso premium.

Las cuotas son por mes calendario UTC, independientemente del día de renovación de la suscripción. Cada solicitud autorizada que se envía al proveedor consume una unidad, incluso si falla o devuelve una respuesta inválida. Un reintento es una solicitud nueva. No se cobran excedentes automáticamente. Se limita el cuerpo a 256 KB y la salida a 8192 tokens. Los valores iniciales se definen en `supabase/functions/_shared/plans.ts`; si se amplían por encima de 500, actualiza también el límite de seguridad de la función SQL `reserve_ai_request` mediante una nueva migración.

- `active` y `trialing`, con precio reconocido y período vigente: acceso según plan.
- Cancelación programada: mantiene acceso hasta el vencimiento; la cuota mensual sigue aplicando.
- `past_due`, `unpaid`, `incomplete`, `incomplete_expired`, `paused` o `canceled`: sin funciones premium. No hay período de gracia en esta implementación.
- Precio desconocido, más de un item, cantidad distinta de uno o período vencido: no conceden acceso premium.
- Fallo al verificar Stripe: falla de forma cerrada para IA; no se presenta el plan como activo.

El historial, las copias y la exportación no dependen del pago. Ningún webhook elimina reuniones. La nube almacena datos mínimos de facturación y uso; las reuniones siguen locales. Al generar IA, los textos pasan transitoriamente por la Edge Function y Gemini. No se registran textos de reuniones en los logs de los handlers.

## Configurar Stripe

1. Usa primero una cuenta y claves de **test**. La cuenta comercial debe poder operar en el país de la entidad vendedora.
2. Crea productos Pro y Plus con un precio recurrente mensual cada uno, importe fijo, cantidad 1 y sin facturación por consumo. Copia sus IDs `price_...`.
3. Crea una configuración del Customer Portal y copia su ID `bpc_...`. Habilita actualización de medio de pago, historial de facturas y cancelación **al final del período**. Para cambios de plan permite únicamente los productos/precios Pro y Plus, sin cambios de cantidad. Configura la política de prorrateo y pago de las actualizaciones antes de activarlas comercialmente.
4. Habilita en Stripe la opción de limitar cada cliente a una suscripción y dirigir suscriptores existentes al portal. Glu también comprueba suscripciones existentes y reutiliza Checkout abiertos; la opción de Stripe cubre la carrera con pagos completados en otra pestaña mientras se crea una sesión.
5. Configura los reintentos de cobro y correos de pagos fallidos en Stripe Billing. Glu muestra el aviso y el portal, pero no envía correos de cobro por cuenta propia.
6. Configura impuestos y facturación de acuerdo con tu operación antes de cobrar. Esta implementación no habilita Stripe Tax automáticamente. Los importes de catálogo son los precios base; el total final se muestra en Checkout.

## Desplegar en Supabase

Prerrequisitos: Supabase Auth ya configurado y CLI de Supabase conectada al proyecto correcto. Estos comandos son pasos de despliegue; no se ejecutaron automáticamente.

```sh
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

Copia `supabase/.env.example` a `supabase/.env.local` y completa:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PLUS`.
- `STRIPE_PORTAL_CONFIGURATION_ID`.
- `BILLING_RETURN_URL`: URL fija y propia, por ejemplo `https://tu-app.com/billing-return.html`. El archivo de retorno está en `public/` y funciona para web y escritorio: invita a volver a Glu sin afirmar que el pago esté confirmado.
- `BILLING_ALLOWED_ORIGINS`: orígenes exactos separados por comas. Incluye tu web y los de escritorio que distribuyas (`tauri://localhost` y/o `http://tauri.localhost`). Sin comodines.
- `GEMINI_API_KEY` y opcionalmente `GEMINI_MODEL`.

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son secretos del entorno alojado. **Nunca los secretos de Stripe, Gemini o service_role en variables VITE_ ni en el cliente.**

```sh
supabase secrets set --env-file supabase/.env.local
supabase functions deploy billing
supabase functions deploy stripe-webhook
supabase functions deploy paid-ai
```

Las funciones tienen `verify_jwt = false` para admitir el webhook y el esquema actual de claves Supabase. Esto **no significa acceso anónimo a billing/paid-ai**: esos handlers exigen Bearer token y lo verifican con `auth.getUser`. Solo stripe-webhook usa la firma de Stripe en vez del JWT.

Registra en Stripe este endpoint:

`https://TU_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`

Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required` y `customer.deleted`.

Usa la versión de API de eventos compatible con el SDK fijado en los archivos `deno.json` (Stripe 23.0.0; el handler solo usa ID, tipo y customer del evento y consulta las suscripciones actuales). Copia el signing secret del endpoint a `STRIPE_WEBHOOK_SECRET` y actualiza los secretos. Para probar localmente con Stripe CLI usa el secreto que entrega `stripe listen`, que es diferente del endpoint alojado.

El frontend usa la misma URL y clave pública Supabase que el login. Si usas un dominio personalizado, ajusta el CSP de Tauri. Después de volver de Stripe, Glu actualiza al recuperar el foco; también existe «Actualizar estado».

## Verificación antes de producción

```sh
npm run check:billing
npm test
npm run test:e2e
npm run build
```

Los tests de backend usan firmas reales del SDK y PostgreSQL embebido (PGlite) para ejecutar la migración, RLS, bloqueos y cuotas. Las peticiones a Stripe y Gemini son controladas y no generan cargos. Los tests de navegador cubren selección de plan, cancelación/renovación, pago fallido y servicio no disponible.

En el proyecto de test real, verifica: compra de ambos planes, actualización de tarjeta, pago que requiere autenticación, pago fallido y posterior recuperación, cambio de plan con prorrateo, cancelación al vencimiento, webhook duplicado y reentregado, retorno en navegador/Tauri y restricciones por cuenta. Prueba la restauración y monitorea errores de webhooks antes de cambiar a claves de producción.

## Límites operativos

- No se implementan equipos, descuentos propios, facturación por minuto, reembolsos ni gestión de contracargos en Glu. Se administran desde Stripe según corresponda.
- El portal y Checkout son alojados en Stripe; Glu nunca recibe números de tarjeta.
- Cada operación premium consulta Stripe. Una interrupción puede impedir temporalmente usar IA, pero no leer o exportar reuniones locales.
- Los bloqueos de actualización vencen a los dos minutos tras un fallo. Las peticiones en conflicto reciben un error recuperable.
- La separación de archivos locales no es cifrado ni DRM. La protección real del servicio pagado está en paid-ai; no en un booleano del cliente.

Referencias: [Checkout](https://docs.stripe.com/payments/checkout/build-subscriptions), [webhooks de suscripciones](https://docs.stripe.com/billing/subscriptions/webhooks), [portal](https://docs.stripe.com/customer-management), [firmas en Supabase Edge](https://supabase.com/docs/guides/functions/examples/stripe-webhooks).
