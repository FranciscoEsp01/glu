import { useEffect, useState } from 'react';
import { auth, supabaseUrl } from '../services/auth';
import { billingRequest } from '../services/billing';
import { errorText } from '../lib/platform';
interface Snapshot {
  generatedAt: string;
  alerts: { key: string; severity: string; message: string; acknowledged_until: string | null }[];
  accounts: {
    user_id: string;
    plan: string;
    tokens: number;
    audio_seconds: number;
    requests: number;
    unmeasured: number;
    estimatedCostUSD: number | null;
  }[];
  requests: {
    id: string;
    user_id: string;
    feature: string;
    status: string;
    created_at: string;
    provider_status: number | null;
  }[];
}
export function OperationsPanel() {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      const session = await auth?.getSession();
      if (!session?.data.session) return;
      const response = await fetch(
        `${supabaseUrl}/rest/v1/operator_accounts?select=user_id&user_id=eq.${session.data.session.user.id}`,
        {
          headers: {
            Authorization: `Bearer ${session.data.session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          signal: AbortSignal.timeout(15000),
        },
      );
      const rows = await response.json();
      if (active && response.ok && Array.isArray(rows) && rows.length === 1) setAllowed(true);
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function refresh() {
    setBusy(true);
    setError('');
    try {
      setSnapshot(await billingRequest<Snapshot>('operations-admin', { action: 'snapshot' }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (open) void refresh();
  }, [open]);
  if (!allowed) return null;
  return (
    <>
      <button className="backup-link" onClick={() => setOpen(true)}>
        Operaciones y consumo
      </button>
      {open && (
        <div className="modal-shade">
          <section
            className="modal-card billing-modal operations-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Operaciones de Glu"
          >
            <header>
              <h2>Operaciones de Glu</h2>
              <button aria-label="Cerrar operaciones" onClick={() => setOpen(false)}>
                ✕
              </button>
            </header>
            <p className="muted">
              Datos de operación sin transcripciones ni contenido de reuniones. Planes según la
              última conciliación con Stripe.
            </p>
            <button disabled={busy} onClick={() => void refresh()}>
              {busy ? 'Consultando…' : 'Actualizar operaciones'}
            </button>
            {error && (
              <p className="notice error-notice" role="alert">
                {error}
              </p>
            )}
            {snapshot && (
              <>
                <p>Actualizado: {new Date(snapshot.generatedAt).toLocaleString('es-CL')}</p>
                <h3>Avisos</h3>
                {!snapshot.alerts.length && <p>No hay avisos activos.</p>}
                {snapshot.alerts.map((a) => (
                  <div className="notice" key={a.key}>
                    <strong>
                      {a.severity === 'critical' ? 'Atención prioritaria' : 'Revisar'}: {a.message}
                    </strong>
                    {a.acknowledged_until && Date.parse(a.acknowledged_until) > Date.now() ? (
                      <p>
                        Revisado hasta {new Date(a.acknowledged_until).toLocaleTimeString('es-CL')}
                      </p>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void (async () => {
                            setBusy(true);
                            try {
                              await billingRequest('operations-admin', {
                                action: 'acknowledge',
                                key: a.key,
                              });
                              await refresh();
                            } catch (e) {
                              setError(errorText(e));
                            } finally {
                              setBusy(false);
                            }
                          })()
                        }
                      >
                        Marcar revisado por 30 minutos
                      </button>
                    )}
                  </div>
                ))}
                <h3>Consumo mensual · hasta 100 cuentas</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Cuenta</th>
                        <th>Plan</th>
                        <th>Solicitudes</th>
                        <th>Tokens</th>
                        <th>Minutos</th>
                        <th>Costo parcial estimado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.accounts.map((a) => (
                        <tr key={a.user_id}>
                          <td title={a.user_id}>{a.user_id.slice(0, 8)}…</td>
                          <td>{a.plan}</td>
                          <td>{a.requests}</td>
                          <td>{Number(a.tokens).toLocaleString('es-CL')}</td>
                          <td>{Math.ceil(a.audio_seconds / 60)}</td>
                          <td>
                            {a.estimatedCostUSD === null
                              ? 'Tarifas no configuradas'
                              : `${a.estimatedCostUSD.toFixed(4)} USD`}
                            <br />
                            {a.unmeasured} operaciones sin medición completa
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted">
                  Estimación con tarifas configuradas, tokens reportados y minutos enviados. No
                  representa la factura del proveedor ni incluye impuestos u otros costos.
                </p>
                <h3>Últimas 50 operaciones</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Función</th>
                        <th>Estado</th>
                        <th>HTTP proveedor</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.requests.map((r) => (
                        <tr key={r.id}>
                          <td title={r.id}>{r.id.slice(0, 8)}…</td>
                          <td>{r.feature}</td>
                          <td>{r.status}</td>
                          <td>{r.provider_status ?? 'Sin confirmar'}</td>
                          <td>{new Date(r.created_at).toLocaleString('es-CL')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
