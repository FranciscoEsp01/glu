import React, { useState, useEffect } from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { 
  Search, 
  Mic, 
  Settings, 
  FileText, 
  Layers, 
  X
} from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    toggleCommandPalette,
    meetings,
    selectMeeting,
    setViewMode,
    toggleSettings,
    startRecording,
  } = useMeetingStore();

  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      } else if (e.key === 'Escape' && isCommandPaletteOpen) {
        toggleCommandPalette(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, toggleCommandPalette]);

  if (!isCommandPaletteOpen) return null;

  const filteredMeetings = meetings.filter((m) =>
    m.title.toLowerCase().includes(query.toLowerCase()) ||
    m.executiveSummary.some((s) => s.toLowerCase().includes(query.toLowerCase())) ||
    m.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  );

  const handleSelectMeeting = (id: string) => {
    selectMeeting(id);
    toggleCommandPalette(false);
  };

  const handleStartRec = () => {
    toggleCommandPalette(false);
    startRecording();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-24 px-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl bg-white dark:bg-[#16181f] rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden flex flex-col max-h-[500px] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Box */}
        <div className="flex items-center px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08] gap-3">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            autoFocus
            placeholder="Buscar reuniones, tareas, comandos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
          />
          <button
            onClick={() => toggleCommandPalette(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results / Commands List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {/* Quick Actions */}
          {!query && (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Acciones Rápidas
              </div>
              <button
                onClick={handleStartRec}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 transition-colors"
              >
                <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
                  <Mic className="w-3.5 h-3.5" />
                </div>
                <span>Iniciar Grabación Global de Audio</span>
                <kbd className="ml-auto font-mono text-[10px] text-gray-400">⌘⇧R</kbd>
              </button>

              <button
                onClick={() => {
                  setViewMode('floating_pill');
                  toggleCommandPalette(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 transition-colors"
              >
                <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <span>Minimizar a Cápsula Flotante (Floating Pill)</span>
              </button>

              <button
                onClick={() => {
                  toggleSettings(true);
                  toggleCommandPalette(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 transition-colors"
              >
                <div className="w-6 h-6 rounded-lg bg-gray-500/10 text-gray-500 flex items-center justify-center">
                  <Settings className="w-3.5 h-3.5" />
                </div>
                <span>Configurar API Keys (Gemini, Deepgram)</span>
              </button>
            </div>
          )}

          {/* Filtered Meetings Results */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Reuniones ({filteredMeetings.length})
            </div>
            {filteredMeetings.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400">
                No se encontraron reuniones que coincidan.
              </div>
            ) : (
              filteredMeetings.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleSelectMeeting(m.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <div>
                      <h5 className="font-semibold text-gray-800 dark:text-gray-200 line-clamp-1">
                        {m.title}
                      </h5>
                      <p className="text-[11px] text-gray-400 line-clamp-1">
                        {m.executiveSummary[0]}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-gray-400 flex-shrink-0 ml-2">
                    {new Date(m.date).toLocaleDateString()}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between text-[11px] text-gray-400 font-mono">
          <span>Usa ↑ ↓ para navegar</span>
          <span>Esc para cerrar</span>
        </div>
      </div>
    </div>
  );
};
