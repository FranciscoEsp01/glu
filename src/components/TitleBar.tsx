import { useMeetingStore } from '../store/useMeetingStore';
import { Layout, Moon, Sun, Settings } from 'lucide-react';
export function TitleBar() {
  const s = useMeetingStore();
  return (
    <header className="title-bar">
      <div className="breadcrumb">
        Mi espacio <span>/</span> Reuniones
      </div>
      <div className="title-actions">
        {s.isProcessingAI && <span className="processing-label">Procesando reunión…</span>}
        <button title="Vista compacta" onClick={() => s.setViewMode('floating_pill')}>
          <Layout size={16} />
        </button>
        <button
          title="Cambiar tema"
          onClick={() =>
            void s.updateSettings({ theme: s.settings.theme === 'dark' ? 'light' : 'dark' })
          }
        >
          {s.settings.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button title="Configuración" onClick={() => s.toggleSettings(true)}>
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}
