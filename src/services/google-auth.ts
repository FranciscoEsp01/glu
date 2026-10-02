import { auth, supabaseUrl } from './auth';
import { desktop, invoke } from '../lib/platform';

const pendingKey = 'glu-google-pending';
export const desktopCallback = 'http://127.0.0.1:42813/auth/callback';

export async function signInWithGoogle(): Promise<void> {
  if (!auth || !supabaseUrl) throw new Error('Configura Supabase para iniciar sesión.');
  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error('No pudimos comprobar el acceso con Google. Inténtalo de nuevo.');
  const settings = await response.json();
  if (!settings.external?.google)
    throw new Error(
      'El acceso con Google aún no está activado. Configura el proveedor Google en Supabase.',
    );
  const state = crypto.randomUUID();
  const redirect = new URL(
    desktop() ? desktopCallback : window.location.origin + window.location.pathname,
  );
  redirect.searchParams.set('glu_oauth_state', state);
  sessionStorage.setItem(pendingKey, JSON.stringify({ state, createdAt: Date.now() }));
  try {
    const { data, error } = await auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirect.href,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
    if (!data.url) throw new Error('Google no devolvió un enlace de acceso.');
    if (!desktop()) {
      window.location.assign(data.url);
      return;
    }
    const callback = await invoke<string>('auth_oauth_sign_in', { url: data.url, state });
    await completeGoogleCallback(new URL(callback));
    window.location.reload();
  } catch (error) {
    sessionStorage.removeItem(pendingKey);
    throw error;
  }
}

export async function completeGoogleCallback(url: URL): Promise<void> {
  const stored = sessionStorage.getItem(pendingKey);
  sessionStorage.removeItem(pendingKey);
  let pending: { state?: string; createdAt?: number } = {};
  try {
    pending = JSON.parse(stored || '{}');
  } catch {
    /* Reject invalid state. */
  }
  if (
    !pending.state ||
    pending.state !== url.searchParams.get('glu_oauth_state') ||
    !pending.createdAt ||
    Date.now() - pending.createdAt > 5 * 60_000 ||
    Date.now() < pending.createdAt
  )
    throw new Error(
      'Este intento de acceso venció o no se inició en esta app. Vuelve a continuar con Google.',
    );
  if (url.searchParams.has('error'))
    throw new Error('El acceso con Google fue cancelado o rechazado.');
  const code = url.searchParams.get('code');
  if (!code || !auth) throw new Error('No recibimos el código de Google. Vuelve a intentarlo.');
  const { data, error } = await auth.exchangeCodeForSession(code);
  if (error) throw error;
  if (!data.session) throw new Error('No se pudo iniciar la sesión con Google.');
}

let callbackPromise: Promise<void> | undefined;
export function finishWebGoogleSignIn(): Promise<void> {
  if (callbackPromise) return callbackPromise;
  const url = new URL(window.location.href);
  if (desktop() || !url.searchParams.has('glu_oauth_state')) return Promise.resolve();
  // Remove one-time codes before any subsequent navigation or third-party request.
  window.history.replaceState(null, '', window.location.pathname);
  callbackPromise = completeGoogleCallback(url);
  return callbackPromise;
}

export async function cancelGoogleSignIn() {
  sessionStorage.removeItem(pendingKey);
  if (desktop()) await invoke('auth_oauth_cancel');
}
