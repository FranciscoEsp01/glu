import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Square, Maximize2, Mic } from 'lucide-react';
import { useMeetingStore } from '../store/useMeetingStore';
import { desktop } from '../lib/platform';
export function FloatingWidget() {
  const s = useMeetingStore();
  const [notes, setNotes] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focus = () => {
      setNotes(true);
      setTimeout(() => input.current?.focus(), 0);
    };
    window.addEventListener('glu-notes', focus);
    return () => window.removeEventListener('glu-notes', focus);
  }, []);
  return (
    <div className={`floating-wrap ${s.viewMode === 'floating_pill' ? 'compact' : ''}`}>
      <div className="floating-pill">
        <div className="timer">
          <span className={`record-dot ${s.isPaused ? 'paused' : ''}`} />
          {Math.floor(s.recordingDurationSeconds / 60)
            .toString()
            .padStart(2, '0')}
          :{(s.recordingDurationSeconds % 60).toString().padStart(2, '0')}
        </div>
        <div className="pill-center">
          {s.isPaused || !s.isRecording || desktop() ? (
            <span className="face">{s.isPaused ? '◡ ◡' : '◡ ◕'}</span>
          ) : (
            <div className="wave-bars">
              {s.audioLevels.map((v, i) => (
                <i key={i} style={{ height: `${4 + v * 24}px` }} />
              ))}
            </div>
          )}
          <small>
            {s.isStarting
              ? 'Preparando…'
              : s.isPaused
                ? 'Captura pausada'
                : s.isRecording
                  ? 'Grabando audio'
                  : 'Lista para escuchar'}
          </small>
        </div>
        <div className="pill-actions">
          <button onClick={() => setNotes(!notes)}>Notas {s.rapidNotes.length || ''}</button>
          {s.isRecording ? (
            <>
              <button
                title={s.isPaused ? 'Reanudar captura' : 'Pausar toda la captura'}
                onClick={() => void s.togglePauseRecording()}
              >
                {s.isPaused ? <Play size={17} /> : <Pause size={17} />}
              </button>
              <button title="Finalizar reunión" onClick={() => void s.stopRecordingAndProcess()}>
                <Square size={16} />
              </button>
            </>
          ) : (
            <button
              disabled={s.isStarting || s.isProcessingAI}
              title="Nueva reunión"
              onClick={() => {
                s.setViewMode('main');
                s.toggleNewMeetingModal(true);
              }}
            >
              <Mic size={17} />
            </button>
          )}
          <button title="Abrir historial" onClick={() => s.setViewMode('main')}>
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
      {notes && (
        <form
          className="quick-notes"
          onSubmit={(e) => {
            e.preventDefault();
            s.addRapidNote(s.currentNoteInput);
          }}
        >
          <input
            ref={input}
            aria-label="Apunte rápido"
            placeholder="Una idea, un acuerdo… Enter para guardar"
            value={s.currentNoteInput}
            onChange={(e) => s.setCurrentNoteInput(e.target.value)}
            disabled={!s.isRecording}
          />
          <button disabled={!s.isRecording}>Guardar</button>
          <small>
            {s.rapidNotes[s.rapidNotes.length - 1] ||
              'Los apuntes se guardan junto con tu reunión.'}
          </small>
        </form>
      )}
    </div>
  );
}
