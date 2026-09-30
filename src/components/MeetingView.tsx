import { useEffect, useState } from 'react';
import { Star, Copy, Download, Trash2, Sparkles, FileText, ArrowUpRight, Plus } from 'lucide-react';
import { useMeetingStore } from '../store/useMeetingStore';
import { storage } from '../services/storage';
import { exportMarkdown, downloadFile } from '../services/export';
import { errorText } from '../lib/platform';
import { AudioPlayer } from './AudioPlayer';
import { ShareModal } from './ShareModal';
import { Integration } from '../services/integrations';
import { TipTapEditor } from './TipTapEditor';
export function MeetingView() {
  const s = useMeetingStore();
  const meeting = s.meetings.find((m) => m.id === s.selectedMeetingId);
  const [url, setUrl] = useState<string>();
  const [seek, setSeek] = useState(0);
  const [message, setMessage] = useState('');
  const [text, setText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [sharing, setSharing] = useState<Integration>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setUrl(undefined);
    setSeek(0);
    setMessage('');
    setConfirmDelete(false);
    setSharing(undefined);
    let cancelled = false;
    let objectUrl: string | undefined;
    if (meeting?.hasAudio && meeting.status !== 'recording')
      void storage
        .playbackUrl(meeting.id)
        .then((source) => {
          if (source && !cancelled) {
            objectUrl = source;
            setUrl(source);
          } else if (source) URL.revokeObjectURL(source);
        })
        .catch((e) => {
          if (!cancelled) setMessage(errorText(e));
        });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [meeting?.id, meeting?.hasAudio, meeting?.status]);
  const busy = s.isProcessingAI || s.isRecording || s.isStarting;
  const importPanel = (
    <div className="import-panel">
      <h3>Trae una conversación</h3>
      <p className="muted">
        Pega una transcripción o importa un archivo de audio. Podrás revisar el contenido antes de
        enviarlo a la IA.
      </p>
      <textarea
        aria-label="Transcripción para importar"
        placeholder="Pega aquí la transcripción…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="form-row">
        <button
          className="primary"
          disabled={!text.trim() || busy}
          onClick={async () => {
            await s.importMeeting(text);
            setText('');
            setShowImport(false);
          }}
        >
          Guardar transcripción
        </button>
        <label className="file-button">
          Importar audio
          <input
            type="file"
            accept="audio/*,.wav,.mp3,.m4a,.mp4,.webm,.ogg,.flac"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 250 * 1024 * 1024) {
                  setMessage('El límite de importación es 250 MB.');
                  return;
                }
                await s.importMeeting('', file);
                setShowImport(false);
              }
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </div>
  );
  if (!meeting)
    return (
      <section className="workspace empty-workspace">
        <div className="welcome-icon">
          <Sparkles size={30} />
        </div>
        <p className="eyebrow">MENOS APUNTES. MÁS CONVERSACIÓN.</p>
        <h1>
          Las buenas ideas
          <br />
          merecen quedarse.
        </h1>
        <p className="welcome-copy">
          Concéntrate en la reunión. Glu organiza tus apuntes,
          <br />
          los acuerdos y los próximos pasos.
        </p>
        <button
          className="primary"
          onClick={() => s.toggleNewMeetingModal(true)}
          disabled={!s.initialized}
        >
          <Plus size={17} /> Grabar mi primera reunión <ArrowUpRight size={16} />
        </button>
        <div className="welcome-features">
          <span>Sin bots en la llamada</span>
          <span>Notas editables</span>
          <span>Historial local</span>
        </div>
        {importPanel}
      </section>
    );
  return (
    <section className="workspace">
      {sharing && (
        <ShareModal
          key={`${meeting.id}-${sharing}`}
          meeting={meeting}
          provider={sharing}
          onClose={() => setSharing(undefined)}
        />
      )}
      <div className="document-toolbar">
        <span className="eyebrow">
          {meeting.templateType.replace(/_/g, ' ')} ·{' '}
          {meeting.status === 'ready'
            ? 'RESUMEN LISTO'
            : meeting.status === 'recording'
              ? 'EN CURSO'
              : 'BORRADOR'}
        </span>
        <div>
          <button title="Destacar reunión" onClick={() => s.toggleStarMeeting(meeting.id)}>
            <Star size={17} fill={meeting.isStarred ? 'currentColor' : 'none'} />
          </button>
          <button title="Importar otra reunión" onClick={() => setShowImport(!showImport)}>
            <Plus size={17} />
          </button>
          <button title="Eliminar reunión" disabled={busy} onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
          <button onClick={() => setMessage('')} aria-label="Cerrar aviso">
            {' '}
            ×
          </button>
        </p>
      )}
      {confirmDelete && (
        <div className="notice">
          ¿Eliminar esta reunión y su audio de este dispositivo?{' '}
          <button onClick={() => setConfirmDelete(false)}>Cancelar</button>{' '}
          <button className="danger" onClick={() => void s.deleteMeeting(meeting.id)}>
            Eliminar definitivamente
          </button>
        </div>
      )}
      {showImport && importPanel}
      <input
        aria-label="Título de reunión"
        className="document-title"
        value={meeting.title}
        onChange={(e) => s.updateMeeting(meeting.id, { title: e.target.value })}
      />
      <p className="document-meta">
        {new Date(meeting.date).toLocaleDateString('es-CL', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}{' '}
        <span>·</span>{' '}
        {meeting.durationMinutes ? `${meeting.durationMinutes} min` : 'Transcripción / notas'}{' '}
        <span>·</span>{' '}
        {meeting.participants.length
          ? `${meeting.participants.length} hablantes`
          : 'Sin participantes identificados'}
      </p>
      <div className="document-actions">
        <button onClick={() => setSharing('slack')} disabled={busy}>
          Slack ↗
        </button>
        <button onClick={() => setSharing('notion')} disabled={busy}>
          Notion ↗
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={() => void s.processMeeting(meeting.id)}
        >
          <Sparkles size={15} />
          {s.isProcessingAI
            ? 'Procesando…'
            : meeting.status === 'ready'
              ? 'Regenerar resumen'
              : 'Generar resumen'}
        </button>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(exportMarkdown(meeting));
              setMessage('Resumen copiado. Puedes pegarlo en Slack, Notion o un correo.');
            } catch {
              setMessage('No se pudo copiar. Usa Descargar Markdown.');
            }
          }}
        >
          <Copy size={14} />
          Copiar
        </button>
        <button
          onClick={() =>
            downloadFile(
              `${meeting.title.replace(/[^\p{L}\p{N} -]/gu, '').slice(0, 80) || 'reunion'}.md`,
              exportMarkdown(meeting),
            )
          }
        >
          <Download size={14} />
          Markdown
        </button>
      </div>
      {meeting.error && <p className="notice error-notice">{meeting.error}</p>}
      <div className="summary-card">
        <div className="section-title">
          <Sparkles size={17} />
          <h2>Lo que importa</h2>
          <span>RESUMEN</span>
        </div>
        {meeting.executiveSummary.length ? (
          <ul>
            {meeting.executiveSummary.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            Tu resumen aparecerá aquí después de procesar la reunión. Los apuntes y la transcripción
            se conservan aunque la IA falle.
          </p>
        )}
      </div>
      <div className="section-title">
        <h2>Tareas y compromisos</h2>
        <span>
          {meeting.actionItems.filter((a) => a.completed).length}/{meeting.actionItems.length}
        </span>
      </div>
      {meeting.actionItems.length ? (
        <div className="task-list">
          {meeting.actionItems.map((a) => (
            <label key={a.id} className="task-row">
              <input
                type="checkbox"
                checked={a.completed}
                onChange={() => s.toggleActionItem(meeting.id, a.id)}
              />
              <span className={a.completed ? 'done' : ''}>
                {a.text}
                <small>
                  {a.assignee || 'Sin responsable'}
                  {a.dueDate ? ` · ${a.dueDate}` : ''}
                </small>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="muted">No hay tareas identificadas.</p>
      )}
      <div className="section-title">
        <h2>Decisiones clave</h2>
      </div>
      <div className="decision-list">
        {meeting.keyDecisions.length ? (
          meeting.keyDecisions.map((d) => (
            <div key={d.id}>
              <span>↗</span>
              <p>
                {d.decision}
                {d.rationale && <small>{d.rationale}</small>}
              </p>
            </div>
          ))
        ) : (
          <p className="muted">No hay decisiones identificadas.</p>
        )}
      </div>
      {!!meeting.unresolvedQuestions?.length && (
        <>
          <h2>Preguntas pendientes</h2>
          <ul>
            {meeting.unresolvedQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </>
      )}
      <div className="section-title">
        <FileText size={16} />
        <h2>Tus notas</h2>
        <span>GUARDADO AUTOMÁTICO</span>
      </div>
      <TipTapEditor
        editable={!s.isProcessingAI}
        key={meeting.id}
        content={meeting.manualNotes}
        onChange={(manualNotes) => s.updateMeeting(meeting.id, { manualNotes })}
      />
      {meeting.originalNotes && (
        <details>
          <summary>Apuntes originales</summary>
          <p className="original-notes">{meeting.originalNotes}</p>
        </details>
      )}
      <details className="transcript-panel" open>
        <summary>
          Transcripción y audio <span>{meeting.rawTranscript.length} fragmentos</span>
        </summary>
        <AudioPlayer audioUrl={url} currentPlaybackTime={seek} onSeek={setSeek} />
        <div className="transcript-lines">
          {meeting.rawTranscript.map((t) => (
            <button key={t.id} onClick={() => setSeek(t.timestamp)}>
              <time>
                {Math.floor(t.timestamp / 60)}:
                {Math.floor(t.timestamp % 60)
                  .toString()
                  .padStart(2, '0')}
              </time>
              <p>
                <strong>{t.speaker}</strong>
                {t.text}
              </p>
            </button>
          ))}
        </div>
        {!meeting.rawTranscript.length && (
          <p className="muted">La transcripción se genera al finalizar o procesar el audio.</p>
        )}
      </details>
    </section>
  );
}
