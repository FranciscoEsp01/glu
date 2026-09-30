import { useMemo, useState } from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { retrieveEvidence, askMeetings, Answer } from '../services/knowledge';
import { errorText } from '../lib/platform';
export function KnowledgeModal() {
  const s = useMeetingStore();
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<Answer>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const evidence = useMemo(() => retrieveEvidence(s.meetings, question), [s.meetings, question]);
  if (!s.isKnowledgeOpen) return null;
  return (
    <div className="modal-shade">
      <section className="modal-card knowledge-modal" aria-label="Preguntar a tus reuniones">
        <header>
          <div>
            <p className="eyebrow">TU MEMORIA DE TRABAJO</p>
            <h2>Pregunta a tus reuniones</h2>
          </div>
          <button
            aria-label="Cerrar preguntas"
            disabled={busy}
            onClick={() => s.toggleKnowledge(false)}
          >
            ✕
          </button>
        </header>
        <p className="muted">
          Encuentra acuerdos, clientes y próximos pasos en tu historial. La búsqueda de fragmentos
          ocurre en este dispositivo.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            setResult(undefined);
            try {
              setResult(await askMeetings(question, evidence, s.settings));
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Tu pregunta
            <textarea
              aria-label="Pregunta sobre reuniones"
              placeholder="¿Qué acordamos con Acme sobre el presupuesto?"
              disabled={busy}
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setResult(undefined);
              }}
            />
          </label>
          <p className="muted">
            {evidence.length} fragmentos relacionados ·{' '}
            {new Set(evidence.map((e) => e.meetingId)).size} reuniones
          </p>
          <button className="primary" disabled={busy || !question.trim()}>
            {busy ? 'Consultando…' : 'Responder con Gemini'}
          </button>
          <p className="privacy-caption">
            Al responder, se envían tu pregunta y los fragmentos mostrados a Google Gemini.
          </p>
        </form>
        {error && (
          <p role="alert" className="notice error-notice">
            {error}
          </p>
        )}
        {result && (
          <div className="knowledge-answer" role="status">
            <h3>Respuesta</h3>
            <p>{result.answer}</p>
            {result.sources.map((source, i) => {
              const item = evidence.find((e) => e.id === source.id);
              return item ? (
                <button
                  key={i}
                  className="evidence-card"
                  onClick={() => {
                    s.selectMeeting(item.meetingId);
                    s.setViewMode('main');
                    s.toggleKnowledge(false);
                  }}
                >
                  <strong>{item.title}</strong>
                  <blockquote>“{source.quote}”</blockquote>
                  <small>Abrir reunión ↗</small>
                </button>
              ) : null;
            })}
          </div>
        )}
        {!!evidence.length && (
          <details>
            <summary>Revisar fragmentos que se enviarán</summary>
            {evidence.map((e) => (
              <div key={e.id} className="evidence-card">
                <strong>{e.title}</strong>
                <p>{e.text}</p>
              </div>
            ))}
          </details>
        )}
      </section>
    </div>
  );
}
