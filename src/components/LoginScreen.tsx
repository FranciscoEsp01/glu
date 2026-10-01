import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Mail, ArrowLeft, ShieldCheck, AudioLines } from 'lucide-react';
import { auth, authError } from '../services/auth';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function sendCode() {
    if (!auth || busy || cooldown) return;
    setBusy(true);
    setError('');
    try {
      const { error } = await auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setSent(true);
      setCode('');
      setCooldown(60);
    } catch (error) {
      setError(authError(error));
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!sent) return sendCode();
    if (!auth || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data, error } = await auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      });
      if (error) throw error;
      if (!data.session) throw new Error('No session');
      window.location.reload();
    } catch (error) {
      setError(authError(error));
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="Glu">
        <div className="brand">
          <span className="brand-mark">g</span>
          <span>
            glu<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="auth-story-content">
          <span className="auth-kicker">MENOS APUNTES. MÁS PRESENCIA.</span>
          <h1>
            Las buenas ideas
            <br />
            merecen quedarse.
          </h1>
          <p>
            Captura tus conversaciones y convierte cada reunión en claridad, decisiones y próximos
            pasos.
          </p>
          <div className="auth-note">
            <AudioLines size={28} />
            <div>
              <strong>Tu próxima gran idea empieza aquí.</strong>
              <span>Reuniones, notas y acuerdos en un solo lugar.</span>
            </div>
          </div>
        </div>
        <small>Un espacio para escuchar, pensar y avanzar.</small>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="auth-icon">
            <Mail size={24} />
          </span>
          <h2>{sent ? 'Revisa tu correo' : 'Bienvenido a Glu'}</h2>
          <p className="auth-description">
            {sent
              ? `Enviamos un código a ${email.trim()}. Ingrésalo para continuar.`
              : 'Inicia sesión o crea tu cuenta con tu correo. Sin contraseñas que recordar.'}
          </p>
          {!auth ? (
            <div className="auth-message" role="alert">
              El acceso todavía no está disponible. Contacta al administrador de Glu para activar
              las cuentas.
            </div>
          ) : (
            <form onSubmit={submit}>
              {sent ? (
                <label>
                  Código de verificación
                  <input
                    autoFocus
                    key="code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]{6,10}"
                    minLength={6}
                    maxLength={10}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ingresa tu código"
                    disabled={busy}
                  />
                </label>
              ) : (
                <label>
                  Correo electrónico
                  <input
                    autoFocus
                    key="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@empresa.com"
                    disabled={busy}
                  />
                </label>
              )}
              {error && (
                <p className="auth-message" role="alert">
                  {error}
                </p>
              )}
              <button className="primary auth-submit" disabled={busy} type="submit">
                {busy ? 'Un momento…' : sent ? 'Entrar a Glu' : 'Continuar con correo'}
                {!busy && <ArrowRight size={17} />}
              </button>
              {sent && (
                <div className="auth-secondary">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setSent(false);
                      setCode('');
                      setError('');
                      setCooldown(0);
                    }}
                  >
                    <ArrowLeft size={14} /> Cambiar correo
                  </button>
                  <button
                    type="button"
                    disabled={busy || cooldown > 0}
                    onClick={() => void sendCode()}
                  >
                    {cooldown ? `Reenviar en ${cooldown}s` : 'Reenviar código'}
                  </button>
                </div>
              )}
            </form>
          )}
          <p className="auth-footnote">
            <ShieldCheck size={16} /> El código confirma que este correo te pertenece.
          </p>
          <p className="auth-local-note">
            Tus reuniones se guardan en este dispositivo. El acceso no sincroniza tu historial con
            la nube.
          </p>
        </div>
      </section>
    </main>
  );
}
