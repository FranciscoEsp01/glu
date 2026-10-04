import { OperationsPanel } from './OperationsPanel';
import { useBillingStore } from '../store/useBillingStore';
import { PLANS, billingNotice } from '../services/billing';
import { useAccount } from './AccountContext';
import { useState } from 'react';
import { auth, authError } from '../services/auth';
import { flushMeetings } from '../store/useMeetingStore';
import { Search, Plus, Star, Settings, Mic } from 'lucide-react';
import { useMeetingStore } from '../store/useMeetingStore';
export function Sidebar() {
  const s = useMeetingStore();
  const account = useAccount();
  const billing = useBillingStore();
  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    if (s.isRecording || s.isStarting || s.isProcessingAI || signingOut) return;
    setSigningOut(true);
    try {
      await flushMeetings();
      const result = await auth?.signOut({ scope: 'local' });
      if (result?.error) throw result.error;
      window.location.reload();
    } catch (error) {
      useMeetingStore.setState({ error: authError(error) });
      setSigningOut(false);
    }
  }
  const query = s.searchQuery.toLocaleLowerCase();
  const meetings = s.meetings.filter(
    (m) =>
      (s.activeCategory !== 'starred' || m.isStarred) &&
      [m.title, ...m.executiveSummary, ...m.rawTranscript.map((t) => t.text), m.manualNotes]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query),
  );
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">g</span>
        <span>
          glu<span className="brand-dot">.</span>
        </span>
        <small>WORKSPACE</small>
      </div>
      <button
        className="primary new-meeting"
        disabled={s.isRecording || s.isStarting || s.isProcessingAI}
        onClick={() => s.toggleNewMeetingModal(true)}
      >
        <Plus size={16} /> Nueva reunión
      </button>
      <div className="search-box">
        <Search size={15} />
        <input
          aria-label="Buscar reuniones"
          placeholder="Buscar en tus reuniones"
          value={s.searchQuery}
          onChange={(e) => s.setSearchQuery(e.target.value)}
        />
        <kbd>⌘K</kbd>
      </div>
      <nav>
        <button
          className={s.activeCategory === 'all' ? 'active' : ''}
          onClick={() => s.setActiveCategory('all')}
        >
          <Mic size={15} />
          Todas las reuniones <span>{s.meetings.length}</span>
        </button>
        <button
          className={s.activeCategory === 'starred' ? 'active' : ''}
          onClick={() => s.setActiveCategory('starred')}
        >
          <Star size={15} />
          Destacadas
        </button>
        <button onClick={() => s.toggleKnowledge(true)}>
          <Search size={15} /> Preguntar a mis reuniones
        </button>
      </nav>
      <p className="eyebrow history-label">TU HISTORIAL</p>
      <div className="meeting-list">
        {meetings.length === 0 && (
          <p className="muted empty-list">
            {query ? 'No hay coincidencias.' : 'Las ideas de tu próxima reunión empiezan aquí.'}
          </p>
        )}
        {meetings.map((m) => (
          <button
            className={`meeting-card ${m.id === s.selectedMeetingId ? 'selected' : ''}`}
            key={m.id}
            onClick={() => s.selectMeeting(m.id)}
          >
            <div>
              <strong>{m.title}</strong>
              {m.isStarred && <Star size={12} />}
            </div>
            <p>
              {new Date(m.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} ·{' '}
              {m.durationMinutes ? `${m.durationMinutes} min` : 'Notas'}
              <span className={`status-dot ${m.status === 'ready' ? 'ready' : ''}`} />
            </p>
            <small>
              {m.status === 'recording'
                ? 'Grabando…'
                : m.status === 'error'
                  ? 'Necesita atención'
                  : m.executiveSummary[0] || 'Lista para procesar'}
            </small>
          </button>
        ))}
      </div>
      <button className="settings-link" onClick={() => s.toggleSettings(true)}>
        <Settings size={16} />
        Configuración
        <span className="connection-dot" />
      </button>
      <button className="backup-link" onClick={() => s.toggleBackup(true)}>
        Copias del historial
      </button>
      <button className="billing-sidebar" onClick={() => billing.setOpen(true)}>
        <strong>Plan y facturación</strong>
        <span>
          {billing.loading
            ? 'Verificando…'
            : billing.status
              ? PLANS[billing.status.plan].name
              : 'Consultar plan'}
        </span>
      </button>
      {billing.status && billingNotice(billing.status.subscriptions) && (
        <button className="billing-warning" onClick={() => billing.setOpen(true)}>
          Revisa el estado de tu suscripción
        </button>
      )}
      <OperationsPanel />
      <div className="account-footer">
        <span title={account.email}>{account.email}</span>
        <button
          disabled={signingOut || s.isRecording || s.isStarting || s.isProcessingAI}
          onClick={() => void signOut()}
        >
          {signingOut ? 'Cerrando…' : 'Cerrar sesión'}
        </button>
      </div>
      <p className="local-label">Historial guardado en este dispositivo</p>
    </aside>
  );
}
