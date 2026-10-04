# Procesamiento persistente de reuniones

La versión 0.7.0 añade una cola por cuenta y reunión en web y Mac. Una sola reunión se procesa a la vez; las demás esperan. Se guardan identificador, etapa, configuración usada, contenido de entrada, bloques completados, estado, errores y siguiente intento junto al historial local (SQLite en Mac y almacenamiento local en web). No se guardan claves en los trabajos. Las copias exportadas excluyen trabajos para impedir que restaurarlas vuelva a enviar operaciones de pago.

## Estados y recuperación

- `queued`: guardado y esperando al ejecutor.
- `running`: transcripción o resumen en curso.
- `retry_wait`: espera con la próxima fecha visible.
- `blocked`: resultado incierto, operación incompatible o recuperación vencida; requiere revisión.
- `failed`: error definitivo o agotamiento de intentos permitidos.
- `succeeded`: resultado validado y guardado en el historial.
- `canceled`: se detienen los pasos pendientes; el contenido original permanece.

Los trabajos que estaban en ejecución al cerrar vuelven a la cola al iniciar sesión con la misma cuenta. El ejecutor requiere Glu abierto y conexión; **no es un trabajador autónomo en la nube** y no continúa los pasos restantes con la aplicación cerrada. Una llamada ya aceptada puede terminar en el servidor. El cierre no cancela ni reembolsa esa llamada. No se sincronizan trabajos entre dispositivos.

Se persiste antes de cada operación y después de cada bloque de cinco minutos. Al reabrir, se omiten bloques completados. El resumen usa una copia fija del contenido al crear el trabajo; editar después el título no cambia una petición ya enviada. Para procesar contenido nuevo, cancela el trabajo pendiente y crea otro. Una operación incierta no se reenvía automáticamente.

## Reintentos y consumo

Se permiten hasta tres intentos automáticos por operación (bloque de audio o resumen), con esperas de 5 y 15 segundos; saturación del servidor espera 60 segundos. Los intentos se conservan al reiniciar. Consultas de una operación en curso esperan cinco segundos, sin crear intentos nuevos del proveedor, hasta un máximo de cinco minutos. La pantalla permite reanudar manualmente o cancelar cuando el ejecutor no está ocupado.

Si falla la conexión entre Glu y el backend, se conserva `x-request-id`: el servidor devuelve el resultado guardado, indica que sigue procesando o bloquea la operación incierta. Si el proveedor devolvió un HTTP 429/5xx confirmado, puede crearse otro identificador dentro del presupuesto de reintentos. Cada llamada nueva al proveedor consume cuota, incluso si falla; no se prometen reembolsos ni procesamiento exactamente una vez en el proveedor. Timeout, formato inválido, falta de permisos, cuotas agotadas y respuestas inciertas no generan reintentos nuevos de pago automáticos.

La reserva y su huella SHA-256 se escriben en la misma transacción. El mismo identificador con otro contenido o idioma se rechaza. Una operación pendiente no se reclama como nueva aunque venza; un resultado puede consultarse solo por su propietario. El historial y el audio se conservan en fallos, y el audio solo se elimina después de guardar el resultado completo si la retención está desactivada.

## Resultados temporales en Supabase

`service_requests` conserva metadatos y estados; `service_results` guarda temporalmente **respuestas del proveedor, que pueden incluir transcripciones y resúmenes**. No contiene el audio ni el prompt enviado. Resultado y consumo se confirman en una transacción: si falla, la reserva queda pendiente y no se duplica la llamada. RLS impide lectura/escritura directa del caché desde el cliente; el handler comprueba propietario y huella.

La recuperación de resultados vence a las 24 horas. La eliminación física se hace en cada cierre de operación y mediante el trabajo horario de limpieza que debe configurarse al desplegar. Sin cron, la recuperación sigue venciendo pero los registros expirados podrían permanecer hasta el siguiente cierre. Los respaldos de la base siguen la política de retención de Supabase.

## Despliegue

El código y las pruebas locales no activan el backend remoto. Con la CLI autenticada y el proyecto vinculado:

```sh
supabase db push
supabase functions deploy paid-ai
supabase functions deploy transcribe
```

Aplica `202610040002_processing.sql` **antes** de publicar los handlers. Conserva la configuración de credenciales, planes y consumo de `BACKEND_CONSUMO.md` y `SUSCRIPCIONES.md`.

Habilita `pg_cron` en Supabase → Integrations → Cron y ejecuta `supabase/cron/cleanup-processing.sql` en el SQL Editor. Verifica el historial de ese trabajo y la ausencia de respuestas expiradas en `service_results`. [Instalación oficial de Cron](https://supabase.com/docs/guides/cron/install), [programación de trabajos](https://supabase.com/docs/guides/cron/quickstart).

## Alcance

Las pruebas cubren pérdida de respuesta, reinicio, continuidad de bloques, resultado vencido, aislamiento de cuentas, concurrencia y fallos de persistencia. No llaman a Gemini/Deepgram reales ni generan cargos. Web Locks evita ejecutar el mismo trabajo simultáneamente en ventanas compatibles; el servidor protege cada identificador incluso sin esa API. El historial local aún se guarda como un conjunto de reuniones: evita editarlo simultáneamente en varias ventanas. No hay cola compartida entre máquinas, SLA, dead-letter administrada ni ejecución distribuida en segundo plano en esta entrega. Preguntas al historial, cobros y envíos Slack/Notion mantienen sus flujos independientes.
