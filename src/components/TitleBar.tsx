import React from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { 
  Sparkles, 
  Settings, 
  Mic, 
  Square, 
  Moon, 
  Sun,
  Layout
} from 'lucide-react';

export const TitleBar: React.FC = () => {
  const { 
    isRecording, 
    stopRecordingAndProcess, 
    viewMode, 
    setViewMode, 
    toggleSettings, 
    toggleNewMeetingModal,
    settings,
    updateSettings,
    isProcessingAI
  } = useMeetingStore();

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      updateSettings({ theme: 'light' });
    } else {
      document.documentElement.classList.add('dark');
      updateSettings({ theme: 'dark' });
    }
  };

  return (
    <div className="h-[44px] w-full bg-transparent flex items-center justify-between px-4 select-none z-30 flex-shrink-0 relative">
      {/* macOS Window Controls (Traffic Lights) */}
      <div className="flex items-center gap-[8px] pl-[12px] absolute left-0">
        <button 
          title="Cerrar" 
          className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] hover:opacity-80 transition-opacity flex items-center justify-center text-[8px] text-black/60 font-bold opacity-90"
        >
        </button>
        <button 
          title="Minimizar a Floating Pill" 
          onClick={() => setViewMode('floating_pill')}
          className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] hover:opacity-80 transition-opacity flex items-center justify-center text-[8px] text-black/60 font-bold opacity-90"
        >
        </button>
        <button 
          title="Pantalla Completa" 
          className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29] hover:opacity-80 transition-opacity flex items-center justify-center text-[8px] text-black/60 font-bold opacity-90"
        >
        </button>
      </div>

      {/* Center Title */}
      <div className="flex-1 flex justify-center">
         <span className="text-[13px] font-medium text-[#374151]">
            AI Meeting Assistant
         </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Record Button / Processing State */}
        {isProcessingAI ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-medium border border-indigo-500/20 animate-pulse">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>Sintetizando con IA...</span>
          </div>
        ) : isRecording ? (
          <button
            onClick={() => stopRecordingAndProcess()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium shadow-sm transition-all animate-pulse"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Finalizar Grabación</span>
          </button>
        ) : (
          <button
            onClick={() => toggleNewMeetingModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-sm transition-all"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Grabar Reunión</span>
            <kbd className="hidden sm:inline-block text-[9px] px-1 rounded bg-indigo-700/60 font-mono">⌘⇧R</kbd>
          </button>
        )}

        {/* View Mode Toggle: Mini Floating Pill */}
        <button
          onClick={() => setViewMode(viewMode === 'main' ? 'floating_pill' : 'main')}
          title={viewMode === 'main' ? 'Cambiar a modo Cápsula Flotante (Floating Pill)' : 'Expandir a Ventana Principal'}
          className="p-1.5 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-gray-500 dark:text-gray-400 transition-colors"
        >
          <Layout className="w-4 h-4" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleDarkMode}
          title="Alternar tema oscuro / claro"
          className="p-1.5 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-gray-500 dark:text-gray-400 transition-colors"
        >
          {settings.theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-gray-600" />
          )}
        </button>

        {/* Settings */}
        <button
          onClick={() => toggleSettings(true)}
          title="Configuración y API Keys"
          className="p-1.5 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-gray-500 dark:text-gray-400 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
