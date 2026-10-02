import { useEffect, useState, type ReactNode } from 'react';
import { auth, authError } from '../services/auth';
import { setAccountId } from '../services/account';
import { useMeetingStore, flushMeetings } from '../store/useMeetingStore';
import { AccountContext } from './AccountContext';
import { finishWebGoogleSignIn } from '../services/google-auth';
import { LoginScreen } from './LoginScreen';

export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'login' | 'error'>('loading');
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const busy = useMeetingStore((s) => s.isRecording || s.isStarting || s.isProcessingAI);
  useEffect(() => {
    let active = true;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    if (!auth) {
      setStatus('login');
      return;
    }
    const {
      data: { subscription },
    } = auth.onAuthStateChange((event, session) => {
      if (!active) return;
      clearTimeout(expiryTimer);
      if (event === 'SIGNED_OUT') setExpired(true);
      if (session?.expires_at) {
        expiryTimer = setTimeout(
          () => {
            if (active) setExpired(true);
          },
          Math.min(2147483647, Math.max(0, session.expires_at * 1000 - Date.now())),
        );
      }
    });
    void (async () => {
      try {
        await finishWebGoogleSignIn();
        const session = await auth.getSession();
        if (session.error) throw session.error;
        if (!session.data.session) {
          if (active) setStatus('login');
          return;
        }
        // Verify with the provider, never trust a user ID read from local storage.
        const { data, error } = await auth.getUser();
        if (error) throw error;
        if (!data.user) throw new Error('Missing user');
        if (active) {
          setAccountId(data.user.id);
          setAccountEmail(data.user.email || 'Mi cuenta');
          setStatus('ready');
        }
      } catch (error) {
        if (active) {
          setError(authError(error));
          setStatus('error');
        }
      }
    })();
    return () => {
      active = false;
      clearTimeout(expiryTimer);
      subscription.unsubscribe();
    };
  }, []);
  if (status === 'login') return <LoginScreen />;
  if (status !== 'ready')
    return (
      <main className="auth-loading">
        <span className="brand-mark">g</span>
        <p role="status">{status === 'loading' ? 'Verificando tu sesión…' : error}</p>
        {status === 'error' && (
          <>
            <button className="primary" onClick={() => window.location.reload()}>
              Reintentar
            </button>
            <button
              onClick={() =>
                void auth?.signOut({ scope: 'local' }).then(() => window.location.reload())
              }
            >
              Volver al acceso
            </button>
          </>
        )}
      </main>
    );
  return (
    <>
      <AccountContext.Provider value={{ email: accountEmail, active: !expired }}>
        <div className="authenticated-app" inert={expired || undefined}>
          {children}
        </div>
      </AccountContext.Provider>
      {expired && (
        <div
          className="auth-expired"
          role="alertdialog"
          aria-modal="true"
          aria-label="Sesión finalizada"
        >
          <div className="auth-card">
            <h2>Tu sesión ha finalizado</h2>
            <p>
              {busy
                ? 'Finaliza la reunión activa antes de volver a iniciar sesión.'
                : 'Vuelve a iniciar sesión para continuar.'}
            </p>
            {useMeetingStore.getState().isRecording && (
              <button
                className="primary"
                onClick={() => void useMeetingStore.getState().stopRecordingAndProcess()}
              >
                Finalizar y guardar reunión
              </button>
            )}
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void flushMeetings()
                  .then(() => window.location.reload())
                  .catch(() =>
                    setError('No se pudo guardar el historial. Reintenta antes de salir.'),
                  )
              }
            >
              Volver al acceso
            </button>
            {error && <p role="alert">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
