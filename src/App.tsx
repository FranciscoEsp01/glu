import React, { useEffect } from 'react';
import { useMeetingStore } from './store/useMeetingStore';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { MeetingView } from './components/MeetingView';
import { FloatingWidget } from './components/FloatingWidget';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal } from './components/SettingsModal';
import { NewMeetingModal } from './components/NewMeetingModal';

export const App: React.FC = () => {
  const {
    viewMode,
    isRecording,
    startRecording,
    stopRecordingAndProcess,
    toggleCommandPalette,
    settings,
  } = useMeetingStore();

  // Apply dark/light theme class on root html
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // Global Keyboard Shortcuts (Cmd+Shift+R, Cmd+K, etc.)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Cmd + Shift + R : Start / Stop recording toggle
      if (isCmdOrCtrl && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault();
        if (isRecording) {
          stopRecordingAndProcess();
        } else {
          startRecording();
        }
      }

      // Cmd + K : Global Command Palette
      if (isCmdOrCtrl && (e.key === 'K' || e.key === 'k')) {
        e.preventDefault();
        toggleCommandPalette();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isRecording, startRecording, stopRecordingAndProcess, toggleCommandPalette]);

  return (
    <main className="w-screen h-screen flex items-center justify-center p-0 sm:p-4 bg-gradient-to-br from-slate-200 via-slate-100 to-indigo-100 dark:from-[#08090c] dark:via-[#0f1118] dark:to-[#181a24] overflow-hidden">
      {/* Floating Pill Overlay (Always available when recording or in pill view mode) */}
      {(viewMode === 'floating_pill' || isRecording) && <FloatingWidget />}

      {/* Main Native macOS Window View */}
      {viewMode === 'main' ? (
        <div className="w-full h-full max-w-[1240px] max-h-[820px] rounded-2xl shadow-mac-window border border-black/10 dark:border-white/10 bg-white/90 dark:bg-[#12141c]/90 backdrop-blur-2xl flex flex-col overflow-hidden transition-all duration-300">
          {/* Title Bar */}
          <TitleBar />

          {/* Window Body: Split View (Sidebar 300px + Main Workspace 780px+) */}
          <div className="flex-1 flex flex-row overflow-hidden">
            <Sidebar />
            <MeetingView />
          </div>
        </div>
      ) : (
        /* Minimalist background container when in floating pill mode */
        <div className="text-center text-gray-500 dark:text-gray-400 space-y-3 animate-in fade-in">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-xl shadow-sm">
            G
          </div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Modo Cápsula Flotante Activo
          </h2>
          <p className="text-xs text-gray-400 max-w-xs">
            Glu está listo en segundo plano para acompañar tus videollamadas en Zoom, Meet y Slack.
          </p>
        </div>
      )}

      {/* Modals & Dialogs */}
      <CommandPalette />
      <SettingsModal />
      <NewMeetingModal />
    </main>
  );
};

export default App;
