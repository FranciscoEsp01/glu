import { createClient } from '@supabase/supabase-js';
import { desktop, invoke } from '../lib/platform';

const url = import.meta.env?.VITE_SUPABASE_URL?.trim();
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const authConfigured = Boolean(url && /^https:\/\//.test(url) && key);
const sessionStorageAdapter = {
  getItem: async (name: string) =>
    desktop() ? invoke<string | null>('auth_session_get') : sessionStorage.getItem(name),
  setItem: async (name: string, value: string) => {
    if (desktop()) await invoke('auth_session_set', { value });
    else sessionStorage.setItem(name, value);
  },
  removeItem: async (name: string) => {
    if (desktop()) await invoke('auth_session_set', { value: null });
    else sessionStorage.removeItem(name);
  },
};
export const auth = authConfigured
  ? createClient(url!, key!, {
      auth: {
        storage: sessionStorageAdapter,
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
  return 'No pudimos completar el acceso. Revisa tu conexión e inténtalo de nuevo.';
}
