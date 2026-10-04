import { HttpError, type Runtime } from './billing-core.ts';

export async function fingerprint(value: string | Uint8Array, context: string) {
  const content = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const prefix = new TextEncoder().encode(context + '\n');
  const bytes = new Uint8Array(prefix.length + content.length);
  bytes.set(prefix);
  bytes.set(content, prefix.length);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join('');
}
export async function replay(
  r: Runtime,
  userId: string,
  id: string,
  hash: string,
  headers: HeadersInit,
): Promise<Response | null> {
  const query = await r.db
    .from('service_requests')
    .select('status,fingerprint,retryable,created_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (query.error)
    throw new HttpError(503, 'No pudimos consultar la operación.', 'state_unavailable', true);
  const operation = query.data;
  if (!operation) return null;
  if (operation.fingerprint !== hash)
    throw new HttpError(409, 'El identificador pertenece a otro contenido.', 'operation_conflict');
  if (operation.status === 'failed')
    throw new HttpError(
      409,
      'La operación anterior falló. El consumo ya registrado se conserva.',
      'operation_failed',
      operation.retryable,
      operation.retryable,
    );
  if (operation.status === 'pending') {
    if (Date.now() - Date.parse(operation.created_at) > 300000)
      throw new HttpError(
        409,
        'La operación se interrumpió y su resultado no está confirmado. No se reenviará automáticamente.',
        'operation_unknown',
      );
    return Response.json(
      { state: 'running', retryable: true, code: 'operation_running' },
      { status: 202, headers },
    );
  }
  const saved = await r.db
    .from('service_results')
    .select('result,expires_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (saved.error)
    throw new HttpError(503, 'No pudimos recuperar el resultado.', 'state_unavailable', true);
  if (!saved.data || Date.parse(saved.data.expires_at) <= Date.now())
    throw new HttpError(
      410,
      'El resultado de esta operación ya no está disponible. No se repetirá el consumo automáticamente.',
      'result_expired',
    );
  return Response.json(saved.data.result, { headers });
}
