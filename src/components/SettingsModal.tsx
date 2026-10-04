import { useEffect, useState } from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
export function SettingsModal() {
  const { settings, updateSettings, isSettingsOpen, toggleSettings } = useMeetingStore();
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (isSettingsOpen) setDraft(settings);
  }, [isSettingsOpen, settings]);
  if (!isSettingsOpen) return null;
  return (
    <div className="modal-shade">
      <form
        className="modal-card"
        aria-label="Configuración"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          await updateSettings(draft);
          setSaving(false);
        }}
      >
        <header>
          <div>
            <p className="eyebrow">TU ESPACIO</p>
            <h2>Configuración</h2>
          </div>
          <button
            type="button"
            onClick={() => toggleSettings(false)}
            aria-label="Cerrar configuración"
          >
            ✕
          </button>
        </header>
        <p className="notice">
          Glu incluye transcripción y resúmenes en Pro y Plus, y preguntas entre reuniones en Plus.
          No necesitas claves de Deepgram ni Gemini. Los minutos y solicitudes se descuentan de tu
          plan.
        </p>
        <div className="form-row">
          <label>
            Idioma
            <select
              value={draft.preferredLanguage}
              onChange={(e) =>
                setDraft({ ...draft, preferredLanguage: e.target.value as 'es' | 'en' })
              }
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            Apariencia
            <select
              value={draft.theme}
              onChange={(e) => setDraft({ ...draft, theme: e.target.value as typeof draft.theme })}
            >
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
              <option value="system">Sistema</option>
            </select>
          </label>
        </div>
        <label>
          Fuente de audio
          <select
            value={draft.captureSource}
            onChange={(e) =>
              setDraft({ ...draft, captureSource: e.target.value as 'dual' | 'microphone' })
            }
          >
            <option value="microphone">Micrófono</option>
            <option value="dual">Micrófono + audio del sistema / pestaña</option>
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={draft.saveLocalAudio}
            onChange={(e) => setDraft({ ...draft, saveLocalAudio: e.target.checked })}
          />{' '}
          Conservar audio después de generar el resumen
        </label>
        <p className="notice">
          El audio se guarda temporalmente para recuperar errores. Al procesar, se envía a Deepgram;
          la transcripción y tus apuntes pasan por el servidor de Glu para validar tu plan y se
          envían a Google Gemini. Para recuperar respuestas perdidas, el servidor conserva los
          resultados durante 24 horas. El historial permanece en este dispositivo. Si desactivas
          conservar audio, se elimina tras generar y guardar el resumen correctamente.
        </p>
        <details className="integration-settings">
          <summary>Conectar Slack y Notion</summary>
          <p className="muted">
            Conexiones mediante tokens de tus integraciones. El envío directo requiere la aplicación
            de escritorio.
          </p>
          <label>
            Token de bot de Slack
            <input
              autoComplete="off"
              type="password"
              value={draft.slackToken || ''}
              onChange={(e) => setDraft({ ...draft, slackToken: e.target.value })}
            />
          </label>
          <label>
            Canal predeterminado de Slack
            <input
              placeholder="C0123456789"
              value={draft.slackChannel || ''}
              onChange={(e) => setDraft({ ...draft, slackChannel: e.target.value })}
            />
          </label>
          <p className="muted">El bot necesita el permiso chat:write y acceso al canal.</p>
          <label>
            Token de integración de Notion
            <input
              autoComplete="off"
              type="password"
              value={draft.notionToken || ''}
              onChange={(e) => setDraft({ ...draft, notionToken: e.target.value })}
            />
          </label>
          <label>
            Página predeterminada de Notion
            <input
              placeholder="ID o enlace de la página"
              value={draft.notionParentPage || ''}
              onChange={(e) => setDraft({ ...draft, notionParentPage: e.target.value })}
            />
          </label>
          <p className="muted">
            Comparte la página de destino con tu integración de Notion y permite insertar contenido.
          </p>
        </details>
        <footer>
          <button type="button" onClick={() => toggleSettings(false)}>
            Cancelar
          </button>
          <button className="primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </footer>
      </form>
    </div>
  );
}
