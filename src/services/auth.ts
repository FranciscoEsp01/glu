import { createClient } from '@supabase/supabase-js';
import { desktop, invoke } from '../lib/platform';

import { supabaseProjectUrl } from './supabase-config';

export const supabaseUrl = supabaseProjectUrl(import.meta.env?.VITE_SUPABASE_URL);
const url = supabaseUrl;
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const authConfigured = Boolean(url && /^https:\/\//.test(url) && key);
const sessionStorageAdapter = {
  getItem: async (name: string) =>
    desktop() && name === 'glu-auth-session'
      ? invoke<string | null>('auth_session_get')
      : sessionStorage.getItem(name),
  setItem: async (name: string, value: string) => {
    if (desktop() && name === 'glu-auth-session') await invoke('auth_session_set', { value });
    else sessionStorage.setItem(name, value);
  },
  removeItem: async (name: string) => {
    if (desktop() && name === 'glu-auth-session') await invoke('auth_session_set', { value: null });
    else sessionStorage.removeItem(name);
  },
};
export const auth = authConfigured
  ? createClient(url!, key!, {
      auth: {
        storage: sessionStorageAdapter,
        flowType: 'pkce',
        storageKey: 'glu-auth-session',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
      },
    }).auth
  : null;

export function authError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'otp_expired') return 'El código es incorrecto o ha vencido. Solicita uno nuevo.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit')
    return 'Has realizado demasiados intentos. Espera unos minutos antes de volver a intentar.';
  if (code === 'email_address_not_authorized')
    return 'El servicio de correo aún no permite enviar a esta dirección. El administrador debe configurar el envío de correos de Glu.';
  if (code === 'signup_disabled') return 'El registro de nuevas cuentas está deshabilitado.';
  if (code === 'email_provider_disabled')
    return 'El acceso por correo está deshabilitado en el servidor.';
  const detail = error as { name?: string; status?: number; message?: string };
  if (detail?.name === 'TimeoutError' || detail?.name === 'AbortError')
    return 'La solicitud tardó demasiado. Revisa tu conexión e inténtalo de nuevo.';
  // Only expose structured identifiers, never raw provider messages or credentials.
  const reference = [code, detail?.name, detail?.status && `HTTP ${detail.status}`]
    .filter((value) => typeof value === 'string' && /^[a-zA-Z0-9_ -]{1,80}$/.test(value))
    .join(' · ');
  return `No pudimos completar el acceso. Inténtalo de nuevo.${reference ? ` Referencia: ${reference}.` : ''}`;
}
