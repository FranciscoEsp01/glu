import { useEffect, useState } from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { MEETING_TEMPLATES } from '../services/templates';
import { TemplateType } from '../types/meeting';
export function NewMeetingModal() {
  const s = useMeetingStore();
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState<TemplateType>('general');
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    if (s.isNewMeetingModalOpen) setConsent(false);
  }, [s.isNewMeetingModalOpen]);
  if (!s.isNewMeetingModalOpen) return null;
  return (
    <div className="modal-shade">
      <form
        className="modal-card"
        aria-label="Nueva reunión"
        onSubmit={async (e) => {
          e.preventDefault();
          if (consent) await s.startRecording(template, title.trim() || undefined);
        }}
      >
        <header>
          <div>
            <p className="eyebrow">CAPTURA LO QUE IMPORTA</p>
            <h2>Nueva reunión</h2>
          </div>
          <button
            type="button"
            onClick={() => s.toggleNewMeetingModal(false)}
            aria-label="Cerrar nueva reunión"
          >
            ✕
          </button>
        </header>
        <label>
          Título
          <input
            autoFocus
            placeholder="¿De qué vamos a conversar?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Tipo de reunión
          <select value={template} onChange={(e) => setTemplate(e.target.value as TemplateType)}>
            {Object.values(MEETING_TEMPLATES).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">{MEETING_TEMPLATES[template].description}</p>
        <p className="notice">
          Fuente:{' '}
          {s.settings.captureSource === 'dual'
            ? 'micrófono y audio del sistema / pestaña'
            : 'micrófono'}
          . Puedes cambiarla en Configuración. La pausa detiene la captura de todas las fuentes.
        </p>
        <label className="check-row">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{' '}
          He informado a los participantes y cuento con permiso para grabar y procesar esta reunión.
        </label>
        <footer>
          <button type="button" onClick={() => s.toggleNewMeetingModal(false)}>
            Cancelar
          </button>
          <button className="primary" disabled={!consent || s.isStarting}>
            {s.isStarting ? 'Solicitando acceso…' : 'Iniciar grabación'}
          </button>
        </footer>
      </form>
    </div>
  );
}
