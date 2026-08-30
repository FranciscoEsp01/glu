import React, { useState, useEffect } from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { Square, Mic, MicOff } from 'lucide-react';

export const FloatingWidget: React.FC = () => {
  const {
    isRecording,
    isPaused,
    recordingDurationSeconds,
    audioLevels,
    rapidNotes,
    currentNoteInput,
    setCurrentNoteInput,
    addRapidNote,
    stopRecordingAndProcess,
    togglePauseRecording,
  } = useMeetingStore();

  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showFace, setShowFace] = useState(true);

  useEffect(() => {
    if (isRecording && !isPaused) {
      // Just started or resumed
      setShowFace(true);
      const winkTimer = setTimeout(() => {
        setShowFace(false); // Transition to waveform
      }, 1500);
      return () => clearTimeout(winkTimer);
    } else if (isPaused) {
      setShowFace(true);
    }
  }, [isRecording, isPaused]);

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

  // Carita SVG (Mascota)
  const FaceSVG = () => (
    <>
      <style>
        {`
          /* El guiño ocurre entre 40% y 80% de la animación (es decir, entre 0.6s y 1.2s) */
          @keyframes winkDraw {
            0%, 40% { stroke-dashoffset: 10px; opacity: 0; }
            45%, 80% { stroke-dashoffset: 0px; opacity: 1; }
            85%, 100% { stroke-dashoffset: 10px; opacity: 0; }
          }
          .wink-draw {
            animation: winkDraw 1.5s ease-out forwards;
          }

          @keyframes hideEye {
            0%, 40% { opacity: 1; }
            45%, 80% { opacity: 0; }
            85%, 100% { opacity: 1; }
          }
          .hide-eye {
            animation: hideEye 1.5s ease-out forwards;
          }
        `}
      </style>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Contorno Circular Abierto Estilo Apple */}
        <circle cx="14" cy="14" r="11.5" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeDasharray="60 12"/>
        
        {/* Ojo Izquierdo */}
        <circle cx="10" cy="11.5" r="1.25" fill="white" 
          className={`transition-opacity duration-200 ${isPaused ? 'opacity-0' : 'opacity-100'}`} 
        />
        <path 
          d="M10 11.5 Q10 10 10 11.5" stroke="white" strokeWidth="1.25" strokeLinecap="round" fill="none" 
          className={`transition-opacity duration-200 ${isPaused ? 'opacity-100' : 'opacity-0'}`} 
        />
        
        {/* Ojo Derecho (Guiño o normal) */}
        {/* El ojo normal se oculta cuando guiña o cuando está pausado (que es cuando tiene los ojos cerrados) */}
        <circle cx="18" cy="11.5" r="1.25" fill="white" 
          className={`transition-opacity duration-200 ${isPaused ? 'opacity-0' : (!isPaused && showFace ? 'hide-eye' : 'opacity-100')}`} 
        />
        
        {/* Ojo cerrado (pausa) */}
        <path 
          d="M18 11.5 Q18 10 18 11.5" stroke="white" strokeWidth="1.25" strokeLinecap="round" fill="none" 
          className={`transition-opacity duration-200 ${isPaused ? 'opacity-100' : 'opacity-0'}`} 
        />

        {/* El arco del guiño feliz animado */}
        <path 
          d="M16.5 11.5C17.2 10.5 18.5 10.5 19.2 11.5" 
          stroke="white" strokeWidth="1.75" strokeLinecap="round" fill="none"
          style={{ strokeDasharray: '10px', strokeDashoffset: '10px' }}
          className={!isPaused && showFace ? 'wink-draw' : 'opacity-0'}
        />
        
        {/* Nariz Minimalista */}
        <path d="M14 10.5V14.5H12.8" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        
        {/* Sonrisa */}
        <path d="M11 17.5 H17" stroke="white" strokeWidth="1.75" strokeLinecap="round" 
          className={`transition-opacity duration-200 ${isPaused ? 'opacity-100' : 'opacity-0'}`} 
        />
        <path d="M10 17.5C11.5 19.5 16.5 19.5 18 17.5" stroke="white" strokeWidth="1.75" strokeLinecap="round" 
          className={`transition-opacity duration-200 ${isPaused ? 'opacity-0' : 'opacity-100'}`} 
        />
      </svg>
    </>
  );

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-top-8 duration-500 ease-out fill-mode-forwards">
      
      {/* Main Floating Pill (580x44) */}
      <div 
        className="w-[580px] h-[44px] rounded-[22px] flex items-center justify-between px-4 shadow-2xl relative"
        style={{
          background: 'rgba(255, 255, 255, 0.16)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}
      >
        {/* ZONA IZQUIERDA (140px) */}
        <div className="flex items-center gap-2 w-[140px]">
          {isRecording && !isPaused ? (
             <div className="relative flex items-center justify-center">
               <div className="w-2 h-2 rounded-full bg-[#EF4444] animate-ping absolute" />
               <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
             </div>
          ) : (
             <div className="w-2 h-2 rounded-full bg-gray-400" />
          )}
          <span className="font-mono text-[13px] font-semibold text-white tracking-wider">
            {formatTimer(recordingDurationSeconds)}
          </span>
        </div>

        {/* ZONA CENTRAL (240px) */}
        <div className="flex items-center justify-center w-[240px] h-full">
          {(isRecording && !isPaused) ? (
            <div className="flex items-center gap-[3px] h-5 justify-center">
              {audioLevels.slice(0, 10).map((lvl, idx) => (
                <div
                  key={idx}
                  style={{ height: `${Math.max(4, lvl * 20)}px` }}
                  className="w-1 rounded-full bg-white transition-all duration-75"
                />
              ))}
            </div>
          ) : (
            <div className="text-white/50 text-[11px] font-medium tracking-wide">PAUSADO</div>
          )}
        </div>

        {/* ZONA DERECHA (160px) */}
        <div className="flex items-center justify-end gap-2 w-[160px]">
          <button
            onClick={() => setShowNoteInput(!showNoteInput)}
            className="h-[26px] px-3 rounded-[13px] text-[11px] text-white font-medium transition-colors hover:bg-white/30 relative"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.20)' }}
          >
            Notas
            {rapidNotes.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-500 text-[8px] flex items-center justify-center font-bold">
                {rapidNotes.length}
              </span>
            )}
          </button>
          
          <button
            onClick={togglePauseRecording}
            className={`w-[26px] h-[26px] rounded-full flex items-center justify-center transition-colors ${
               isPaused ? 'bg-amber-500 hover:bg-amber-600' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {isPaused ? <MicOff className="w-3.5 h-3.5 text-white" /> : <Mic className="w-3.5 h-3.5 text-white" />}
          </button>

          <button
            onClick={stopRecordingAndProcess}
            className="w-[26px] h-[26px] rounded-full flex items-center justify-center bg-white/10 hover:bg-rose-500 hover:text-white transition-colors"
          >
            <Square className="w-3 h-3 text-white fill-current" />
          </button>
        </div>
      </div>

      {/* 
        FACE ID DROPDOWN BOX 
        Cuadro que hace slide-in HACIA ABAJO debajo de la barra 
      */}
      <div className="absolute top-[44px] left-1/2 -translate-x-1/2 overflow-hidden w-24 h-24 flex justify-center pointer-events-none">
        <div 
          className={`mt-3 w-12 h-12 flex items-center justify-center transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] shadow-2xl ${
            showFace ? 'translate-y-0 opacity-100' : '-translate-y-[150%] opacity-0'
          }`}
          style={{
            background: 'rgba(20, 20, 20, 0.7)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '14px'
          }}
        >
          <FaceSVG />
        </div>
      </div>

      {/* Rapid Note Popover */}
      {showNoteInput && (
        <div className="w-[580px] bg-white/10 backdrop-blur-xl rounded-2xl p-3 shadow-2xl border border-white/20 text-white animate-in slide-in-from-top-2 duration-150 flex flex-col gap-2 mt-2">
          <div className="flex items-center justify-between text-[11px] text-gray-300">
            <span className="font-semibold">✏️ Apunte Rápido</span>
            <kbd className="text-[9px] px-1 rounded bg-white/10 font-mono">Enter</kbd>
          </div>
          <input
            type="text"
            autoFocus
            placeholder="Escribe una nota rápida..."
            value={currentNoteInput}
            onChange={(e) => setCurrentNoteInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-white/30"
          />
          {rapidNotes.length > 0 && (
            <div className="text-[10px] text-gray-300 max-h-24 overflow-y-auto space-y-1 pt-1 border-t border-white/10">
              {rapidNotes.map((n, i) => (
                <div key={i} className="line-clamp-1">• {n}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
