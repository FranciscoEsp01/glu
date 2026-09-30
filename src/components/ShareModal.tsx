import { useState } from 'react';
import { Meeting } from '../types/meeting';
import { useMeetingStore } from '../store/useMeetingStore';
import { Integration, sendMeeting, shareContent } from '../services/integrations';
import { desktop, errorText } from '../lib/platform';
export function ShareModal({
  meeting,
  provider,
  onClose,
}: {
  meeting: Meeting;
  provider: Integration;
  onClose: () => void;
}) {
  const s = useMeetingStore();
  const [content, setContent] = useState(() => shareContent(meeting));
  const [destination, setDestination] = useState(
    provider === 'slack' ? s.settings.slackChannel || '' : s.settings.notionParentPage || '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const label = provider === 'slack' ? 'Slack' : 'Notion';
  const token = provider === 'slack' ? s.settings.slackToken : s.settings.notionToken;
  return (
    <div className="modal-shade">
      <form
        className="modal-card share-modal"
        aria-label={`Compartir en ${label}`}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            setReceipt(await sendMeeting(provider, meeting.title, content, destination.trim()));
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <header>
          <div>
            <p className="eyebrow">REVISA ANTES DE COMPARTIR</p>
            <h2>Enviar a {label}</h2>
          </div>
          <button type="button" disabled={busy} aria-label="Cerrar compartir" onClick={onClose}>
            ✕
          </button>
        </header>
        {!desktop() && (
          <p className="notice">
            El envío directo está disponible en Glu para escritorio. En navegador usa Copiar o
            Markdown.
          </p>
        )}
        {!token && <p className="notice">Falta conectar {label} en Configuración.</p>}
        <label>
          {provider === 'slack' ? 'ID del canal de Slack' : 'Página de destino en Notion'}
          <input
            required
            disabled={busy || !!receipt}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={provider === 'slack' ? 'C0123456789' : 'ID o enlace de la página'}
          />
        </label>
        <label>
          Contenido que se enviará
          <textarea
            aria-label="Contenido para compartir"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={busy || !!receipt}
          />
        </label>
        <p className="privacy-caption">
          Se enviará únicamente este texto al destino indicado. No se adjuntará audio.
        </p>
        {error && (
          <p role="alert" className="notice error-notice">
            {error}
          </p>
        )}
        {receipt && (
          <p role="status" className="notice">
            {label === 'Slack' ? 'Mensaje enviado a Slack.' : 'Página creada en Notion.'}{' '}
            Referencia: {receipt}
          </p>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            {receipt ? 'Cerrar' : 'Cancelar'}
          </button>
          {!receipt && (
            <button className="primary" disabled={busy || !desktop() || !token || !content.trim()}>
              {busy ? 'Enviando…' : `Enviar a ${label}`}
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}
