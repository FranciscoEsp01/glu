import { auth, supabaseUrl } from './auth';
import { ProcessingError } from './processing-state';
export async function processingRequest<T>(
  endpoint: 'paid-ai' | 'transcribe',
  body: string | Uint8Array,
  id: string,
  language?: string,
): Promise<T> {
  if (!auth || !supabaseUrl) throw new ProcessingError('Inicia sesión para continuar.', 'auth');
  const { data, error } = await auth.getSession();
  if (error || !data.session)
    throw new ProcessingError('Tu sesión finalizó. Vuelve a iniciar sesión.', 'auth');
  let response: Response;
  try {
    response = await fetch(
      `${supabaseUrl}/functions/v1/${endpoint}${language ? `?language=${language}` : ''}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type':
            endpoint === 'transcribe' ? 'application/octet-stream' : 'application/json',
          'x-request-id': id,
        },
        body: typeof body === 'string' ? body : new Uint8Array(body).buffer,
        signal: AbortSignal.timeout(110000),
      },
    );
  } catch {
    throw new ProcessingError(
      'Conexión interrumpida. Recuperaremos la misma operación sin reenviarla al proveedor.',
      'connection',
      true,
    );
  }
  window.dispatchEvent(new Event('glu-billing-refresh'));
  let result: any;
  try {
    result = await response.json();
  } catch {
    throw new ProcessingError(
      'No pudimos leer el resultado. Consultaremos la misma operación.',
      'connection',
      true,
    );
  }
  if (response.status === 202)
    throw new ProcessingError(
      'El servidor sigue procesando esta operación.',
      'operation_running',
      true,
    );
  if (!response.ok) {
    if (response.status === 402 || (response.status === 429 && result?.code !== 'busy'))
      window.dispatchEvent(new Event('glu-billing-required'));
    throw new ProcessingError(
      typeof result?.error === 'string' ? result.error : 'El procesamiento no está disponible.',
      result?.code || `http_${response.status}`,
      result?.retryable === true,
      result?.newOperation === true,
    );
  }
  return result as T;
}
