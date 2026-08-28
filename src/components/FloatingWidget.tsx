import React, { useState } from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { MEETING_TEMPLATES } from '../services/templates';
import { 
  Square, 
  Maximize2, 
  Sparkles, 
  Check, 
  ChevronDown
} from 'lucide-react';

export const FloatingWidget: React.FC = () => {
  const {
    isRecording,
    recordingDurationSeconds,
    audioLevels,
    rapidNotes,
    currentNoteInput,
    setCurrentNoteInput,
    addRapidNote,
    stopRecordingAndProcess,
    recordingTemplate,
    setRecordingTemplate,
    setViewMode,
    isProcessingAI,
  } = useMeetingStore();

  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && currentNoteInput.trim()) {
      addRapidNote(currentNoteInput);
      setCurrentNoteInput('');
      setShowNoteInput(false);
    } else if (e.key === 'Escape') {
      setShowNoteInput(false);
    }
  };

  const template = MEETING_TEMPLATES[recordingTemplate];

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Rapid Note Expanded Popover */}
      {showNoteInput && (
        <div className="w-80 glass-pill rounded-2xl p-3 shadow-2xl border border-white/20 text-white animate-in zoom-in-95 duration-150 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-gray-300">
            <span className="font-semibold">✏️ Apunte Rápido en Vivo</span>
            <kbd className="text-[9px] px-1 rounded bg-white/10 font-mono">Enter para guardar</kbd>
          </div>
          <input
            type="text"
            autoFocus
            placeholder="Ej: Revisar con Juan lo del bug en auth..."
            value={currentNoteInput}
            onChange={(e) => setCurrentNoteInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          {rapidNotes.length > 0 && (
            <div className="text-[10px] text-gray-400 max-h-20 overflow-y-auto space-y-1 pt-1 border-t border-white/10">
              {rapidNotes.map((n, i) => (
                <div key={i} className="line-clamp-1 text-gray-300">• {n}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Floating Pill */}
      <div className="glass-pill h-12 px-4 rounded-full shadow-2xl flex items-center gap-3.5 select-none border border-white/20 transition-all hover:border-white/30 backdrop-blur-3xl">
        {/* Left: Recording Status & Pulse */}
        <div className="flex items-center gap-2">
          {isRecording ? (
            <div className="relative flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping absolute" />
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            </div>
          ) : (
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          )}

          <span className="font-mono text-xs font-bold text-white tracking-wider">
            {formatTimer(recordingDurationSeconds)}
          </span>
        </div>

        <div className="w-[1px] h-5 bg-white/15" />

        {/* Center: Live Waveform Visualizer */}
        <div className="flex items-center gap-[3px] h-5 w-20 justify-center">
          {audioLevels.slice(0, 10).map((lvl, idx) => (
            <div
              key={idx}
              style={{
                height: `${Math.max(4, lvl * 20)}px`,
              }}
              className="w-1 rounded-full bg-indigo-400/90 transition-all duration-100"
            />
          ))}
        </div>

        <div className="w-[1px] h-5 bg-white/15" />

        {/* Rapid Note Trigger Button */}
        <button
          onClick={() => setShowNoteInput(!showNoteInput)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
            showNoteInput
              ? 'bg-indigo-500 text-white'
              : 'bg-white/10 hover:bg-white/20 text-gray-200'
          }`}
          title="Tomar apunte rápido (Cmd+Shift+N)"
        >
          <span>✏️ Nota</span>
          {rapidNotes.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-indigo-600 text-[9px] flex items-center justify-center font-bold">
              {rapidNotes.length}
            </span>
          )}
        </button>

        {/* Template Quick Selector */}
        <div className="relative">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px] text-gray-300 transition-all"
            title="Cambiar plantilla de IA"
          >
            <span>{template.name.split(' ')[0]}</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {showTemplates && (
            <div className="absolute bottom-12 right-0 w-52 glass-pill rounded-2xl p-1.5 shadow-2xl border border-white/20 text-white animate-in zoom-in-95 duration-100 flex flex-col gap-1 z-50">
              {Object.values(MEETING_TEMPLATES).map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setRecordingTemplate(t.id);
                    setShowTemplates(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center justify-between ${
                    recordingTemplate === t.id
                      ? 'bg-indigo-600 text-white'
                      : 'hover:bg-white/10 text-gray-300'
                  }`}
                >
                  <span>{t.name}</span>
                  {recordingTemplate === t.id && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-[1px] h-5 bg-white/15" />

        {/* Finish Recording / Stop Button */}
        {isProcessingAI ? (
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-medium animate-pulse">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>Sintetizando...</span>
          </div>
        ) : (
          <button
            onClick={() => stopRecordingAndProcess()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md transition-all active:scale-95"
            title="Finalizar reunión y generar resumen (Cmd+Shift+R)"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Fin</span>
          </button>
        )}

        {/* Maximize to full macOS window */}
        <button
          onClick={() => setViewMode('main')}
          className="p-1 text-gray-400 hover:text-white transition-colors"
          title="Expandir a Visualizador de Reuniones completo"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
