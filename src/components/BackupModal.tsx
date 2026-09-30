import { useState } from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { backupHistory, parseBackup, mergeHistory } from '../services/backup';
import { downloadFile } from '../services/export';
import { errorText } from '../lib/platform';
import { Meeting } from '../types/meeting';
export function BackupModal() {
  const s = useMeetingStore();
  const [pending, setPending] = useState<Meeting[]>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (!s.isBackupOpen) return null;
  const added =
    pending?.filter((m) => !s.meetings.some((existing) => existing.id === m.id)).length || 0;
  return (
    <div className="modal-shade">
      <section className="modal-card" aria-label="Copias del historial">
        <header>
          <div>
            <p className="eyebrow">TUS DATOS, CONTIGO</p>
            <h2>Copias del historial</h2>
          </div>
          <button aria-label="Cerrar copias" disabled={busy} onClick={() => s.toggleBackup(false)}>
            ✕
          </button>
        </header>
        <p className="muted">
          Descarga todas tus notas, transcripciones, decisiones y tareas en un archivo restaurable.
          No incluye audios ni claves de API.
        </p>
        <button
          className="primary"
          disabled={!s.initialized || busy}
          onClick={() =>
            downloadFile(
              `glu-historial-${new Date().toISOString().slice(0, 10)}.json`,
              backupHistory(s.meetings),
              'application/json',
            )
          }
        >
          Descargar copia · {s.meetings.length} reuniones
        </button>
        <hr />
        <h3>Restaurar una copia</h3>
        <p className="muted">
          Se añadirán las reuniones que falten. Las que ya existen se conservan sin cambios.
        </p>
        <label className="file-button">
          Elegir archivo de Glu
          <input
            aria-label="Archivo de copia"
            type="file"
            accept=".json,application/json"
            disabled={busy || s.isRecording || s.isProcessingAI}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              setMessage('');
              setPending(undefined);
              if (file)
                try {
                  if (file.size > 50 * 1024 * 1024) throw new Error('La copia supera 50 MB.');
                  setPending(parseBackup(await file.text()));
                } catch (e) {
                  setMessage(errorText(e));
                }
              e.target.value = '';
            }}
          />
        </label>
        {pending && (
          <div className="notice">
            <p>
              {added} reuniones nuevas · {pending.length - added} ya existentes
            </p>
            <button
              className="primary"
              disabled={busy || !added}
              onClick={async () => {
                setBusy(true);
                try {
                  await s.restoreHistory(mergeHistory(s.meetings, pending));
                  setMessage(`Se restauraron ${added} reuniones.`);
                  setPending(undefined);
                } catch (e) {
                  setMessage(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Restaurar {added} reuniones
            </button>
          </div>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
