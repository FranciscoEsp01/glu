import { HttpError, type Runtime } from './billing-core.ts';
import { PLANS, type Plan } from './plans.ts';
export async function reserve(
  r: Runtime,
  userId: string,
  id: string,
  feature: string,
  plan: Plan,
  tokens = 0,
  audio = 0,
  fingerprint?: string,
) {
  const limits = PLANS[plan];
  const result = await r.db.rpc(
    fingerprint ? 'reserve_service_operation' : 'reserve_service_request',
    {
      p_user_id: userId,
      p_id: id,
      p_feature: feature,
      p_requests: limits.aiRequests,
      p_tokens_limit: limits.tokens,
      p_audio_limit: limits.audioSeconds,
      p_tokens: tokens,
      p_audio: audio,
      ...(fingerprint ? { p_fingerprint: fingerprint } : {}),
    },
  );
  if (result.error)
    throw new HttpError(
      503,
      'No pudimos registrar el consumo. Reintenta.',
      'state_unavailable',
      true,
    );
  if (result.data === 'duplicate')
    throw new HttpError(
      409,
      'Esta operación ya fue enviada. No se volverá a cobrar al proveedor.',
      'duplicate',
      true,
    );
  if (result.data !== 'ok')
    throw new HttpError(
      429,
      result.data === 'quota'
        ? 'Alcanzaste el límite mensual de tu plan. Revisa tu consumo.'
        : 'Hay demasiadas operaciones en curso. Espera un minuto e inténtalo de nuevo.',
      result.data === 'quota' ? 'quota' : 'busy',
      result.data !== 'quota',
    );
}
export async function finish(
  r: Runtime,
  userId: string,
  id: string,
  success: boolean,
  usage?: { input: number | null; output: number | null; total: number | null },
  status?: number,
  output?: unknown,
  retryable = false,
) {
  const result = await r.db.rpc('finish_service_operation', {
    p_user_id: userId,
    p_id: id,
    p_success: success,
    p_input: usage?.input ?? null,
    p_output: usage?.output ?? null,
    p_total: usage?.total ?? null,
    p_status: status ?? null,
    p_result: output ?? null,
    p_retryable: retryable,
  });
  if (result.error)
    throw new HttpError(
      503,
      'La operación se procesó, pero no pudimos confirmar el consumo. Revisa tu cuenta antes de reintentar.',
    );
}
export function usageMetadata(data: any) {
  const n = (v: unknown) =>
    Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= 1000000 ? Number(v) : null;
  const u = data?.usageMetadata;
  return {
    input: n(u?.promptTokenCount),
    output: n(u?.candidatesTokenCount),
    total: n(u?.totalTokenCount),
  };
}
export function requestId(value: string | null) {
  if (
    value &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
    throw new HttpError(400, 'Identificador de operación inválido.');
  return value || crypto.randomUUID();
}
