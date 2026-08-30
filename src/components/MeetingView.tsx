import React, { useState } from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { AudioPlayer } from './AudioPlayer';
import { ChevronDown } from 'lucide-react';
import confetti from 'canvas-confetti';

export const MeetingView: React.FC = () => {
  const { meetings, selectedMeetingId, toggleActionItem } = useMeetingStore();
  const [currentAudioSec, setCurrentAudioSec] = useState(0);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const meeting = meetings.find((m) => m.id === selectedMeetingId) || meetings[0];

  if (!meeting) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-white p-8">
        <h3 className="text-base font-semibold text-gray-600">No hay reunión seleccionada</h3>
      </div>
    );
  }

  const meetingDate = new Date(meeting.date);

  const triggerExportNotification = (type: string) => {
    setCopyFeedback(type);
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.2, x: 0.7 },
      colors: ['#6366f1', '#a855f7', '#ec4899'],
    });
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  const copyForSlack = () => {
    // simplified for brevity
    triggerExportNotification('slack');
  };

  const copyForNotion = () => {
    // simplified for brevity
    triggerExportNotification('notion');
  };

  return (
    <div className="flex-1 h-full bg-[#FFFFFF] flex flex-col overflow-y-auto select-text p-[32px] relative">
      {/* Toast Notification */}
      {copyFeedback && (
        <div className="absolute top-4 right-8 z-50 bg-gray-900 text-white text-xs px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-2 animate-bounce">
          <span>
            {copyFeedback === 'slack' && '¡Enviado a Slack!'}
            {copyFeedback === 'notion' && '¡Exportado a Notion!'}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="space-y-3">
          <h1 className="text-[20px] font-bold text-[#111827] tracking-tight leading-tight">
            {meeting.title}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-gray-500 font-medium">
               {meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {meetingDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold bg-gray-100 text-gray-800 px-2 py-0.5 rounded-md flex flex-col items-center justify-center leading-none text-center">
                 <span className="text-[14px] leading-tight">{meetingDate.getDate()}</span>
                 <span className="text-[8px] uppercase">{meetingDate.toLocaleDateString('es-ES', { month: 'short' })}</span>
              </span>
            </div>
            <div className="flex -space-x-1">
               {meeting.participants.map((p) => (
                  <img
                     key={p.id}
                     src={p.avatar}
                     alt={p.name}
                     className="w-6 h-6 rounded-full ring-2 ring-white object-cover"
                  />
               ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyForNotion}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-medium text-gray-700 transition-colors"
          >
            Exportar a Notion
          </button>
          <button
            onClick={copyForSlack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-medium text-gray-700 transition-colors"
          >
            Enviar a Slack
          </button>
        </div>
      </div>

      <div className="max-w-3xl space-y-8">
         {/* Resumen Ejecutivo */}
         <section>
            <h2 className="text-[16px] font-bold text-gray-900 mb-3">Resumen Ejecutivo</h2>
            <ul className="space-y-[10px] pl-5 list-disc text-[14px] leading-[22px] text-gray-800">
               {meeting.executiveSummary.map((bullet, idx) => (
                  <li key={idx} className="pl-1 marker:text-gray-400">{bullet}</li>
               ))}
            </ul>
         </section>

         {/* Tareas y Compromisos */}
         <section>
            <h2 className="text-[16px] font-bold text-gray-900 mb-3">Tareas y Compromisos</h2>
            <div className="space-y-2">
               {meeting.actionItems.map((action) => (
                  <div key={action.id} className="flex items-center gap-2 text-[14px] text-gray-800">
                     <input 
                        type="checkbox" 
                        checked={action.completed}
                        onChange={() => toggleActionItem(meeting.id, action.id)}
                        className="w-[14px] h-[14px] text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                     />
                     <span className={`${action.completed ? 'line-through text-gray-400' : ''}`}>
                        {action.text} {action.assignee && `(${action.assignee}${action.dueDate ? `, ${action.dueDate}` : ''})`}
                     </span>
                  </div>
               ))}
            </div>
         </section>

         {/* Decisiones Clave */}
         <section>
            <h2 className="text-[16px] font-bold text-gray-900 mb-3">Decisiones Clave</h2>
            <div className="flex flex-wrap gap-2">
               {meeting.keyDecisions.map((dec) => (
                  <div key={dec.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F3F4F6] border border-gray-200 text-[13px] text-gray-800">
                     <span className="text-gray-400 border border-gray-300 rounded-[3px] w-3 h-3 flex items-center justify-center text-[8px]">✗</span>
                     {dec.decision}
                  </div>
               ))}
            </div>
         </section>

         {/* Transcripción con Audio */}
         <section className="mt-12 bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4 cursor-pointer text-gray-700 hover:text-gray-900">
               <ChevronDown className="w-4 h-4" />
               <h3 className="text-[14px] font-bold">Transcripción con Audio</h3>
            </div>
            
            <AudioPlayer
               audioUrl={meeting.audioUrl}
               durationSec={meeting.audioDurationSec || 52}
               currentPlaybackTime={currentAudioSec}
               onSeek={(sec) => setCurrentAudioSec(sec)}
            />

            <div className="mt-4 text-[13px] text-gray-800 space-y-2 max-h-40 overflow-y-auto pr-2">
               {meeting.rawTranscript.map((seg) => (
                  <div key={seg.id} className="leading-relaxed cursor-pointer hover:bg-gray-100 p-1 rounded" onClick={() => setCurrentAudioSec(seg.timestamp)}>
                     <span className="font-bold">{seg.speaker}:</span> "{seg.text}"
                  </div>
               ))}
            </div>
         </section>
      </div>
    </div>
  );
};
