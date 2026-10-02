import { auth, supabaseUrl } from './auth';
import { desktop, invoke } from '../lib/platform';
export type { BillingStatus, PaidFeature, Plan } from '../../supabase/functions/_shared/plans';
export { PLANS, billingNotice } from '../../supabase/functions/_shared/plans';
export async function billingRequest<T>(
  endpoint: 'billing' | 'paid-ai',
  body: Record<string, unknown>,
): Promise<T> {
  if (!auth) throw new Error('Inicia sesión para gestionar tu plan.');
  const { data, error } = await auth.getSession();
  if (error || !data.session) throw new Error('Tu sesión ha finalizado. Vuelve a iniciar sesión.');
  let response: Response;
  try {
    response = await fetch(
      `${supabaseUrl}/functions/v1/${endpoint}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(endpoint === 'paid-ai' ? 110000 : 30000),
      },
    );
  } catch {
    throw new Error(
      'No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.',
    );
  }
  const result = await response.json().catch(() => null);
  if (endpoint === 'paid-ai') window.dispatchEvent(new Event('glu-billing-refresh'));
  if (!response.ok) {
    if (response.status === 402 || response.status === 429)
      window.dispatchEvent(new Event('glu-billing-required'));
    throw new Error(
      typeof result?.error === 'string'
        ? result.error
        : 'La facturación todavía no está disponible. Inténtalo más tarde.',
    );
  }
  return result as T;
}
export function validStripeUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    !['checkout.stripe.com', 'billing.stripe.com'].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error('El enlace de pago no es válido.');
  return url.href;
}
export async function openStripe(url: string) {
  const safe = validStripeUrl(url);
  if (desktop()) await invoke('open_billing_url', { url: safe });
  else window.open(safe, '_blank', 'noopener,noreferrer');
}
