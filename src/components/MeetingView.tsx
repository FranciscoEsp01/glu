import React, { useState } from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { MEETING_TEMPLATES } from '../services/templates';
import { TipTapEditor } from './TipTapEditor';
import { AudioPlayer } from './AudioPlayer';
import { 
  CheckCircle2, 
  Circle, 
  Sparkles, 
  Copy, 
  MessageSquare, 
  FileText, 
  User, 
  Tag, 
  AlertCircle, 
  Check 
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const MeetingView: React.FC = () => {
  const { meetings, selectedMeetingId, updateMeeting, toggleActionItem } = useMeetingStore();
  const [currentAudioSec, setCurrentAudioSec] = useState(0);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'notes' | 'transcript'>('summary');

  const meeting = meetings.find((m) => m.id === selectedMeetingId) || meetings[0];

  if (!meeting) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center text-gray-400 p-8">
        <Sparkles className="w-12 h-12 text-indigo-400/40 mb-3" />
        <h3 className="text-base font-semibold text-gray-600 dark:text-gray-300">No hay reunión seleccionada</h3>
        <p className="text-xs text-gray-400 mt-1">Selecciona una reunión de la barra lateral o inicia una nueva grabación.</p>
      </div>
    );
  }

  const template = MEETING_TEMPLATES[meeting.templateType] || MEETING_TEMPLATES.general;
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

  const copyAsMarkdown = () => {
    const md = `# ${meeting.title}
**Fecha**: ${meetingDate.toLocaleDateString()} | **Duración**: ${meeting.durationMinutes} min
**Plantilla**: ${template.name}

## 📌 Resumen Ejecutivo
${meeting.executiveSummary.map((s) => `- ${s}`).join('\n')}

## ☑️ Tareas y Compromisos (Action Items)
${meeting.actionItems.map((a) => `- [${a.completed ? 'x' : ' '}] ${a.text} (${a.assignee || 'Sin asignar'} - ${a.dueDate || 'Pronto'})`).join('\n')}

## 🏷️ Decisiones Clave
${meeting.keyDecisions.map((d) => `- **${d.decision}**: ${d.rationale || ''}`).join('\n')}

## 🎙️ Transcripción
${meeting.rawTranscript.map((t) => `**${t.speaker}** (${Math.floor(t.timestamp)}s): ${t.text}`).join('\n')}
`;
    navigator.clipboard.writeText(md);
    triggerExportNotification('markdown');
  };

  const copyForSlack = () => {
    const slackText = `*📋 ${meeting.title}* (${meetingDate.toLocaleDateString()} - ${meeting.durationMinutes}m)

*📌 Resumen:*
${meeting.executiveSummary.map((s) => `• ${s}`).join('\n')}

*☑️ Action Items:*
${meeting.actionItems.map((a) => `• [${a.completed ? '✅' : '⬜'}] *${a.text}* — _@${a.assignee || 'equipo'}_`).join('\n')}

*🏷️ Decisiones:*
${meeting.keyDecisions.map((d) => `• *${d.decision}* (${d.category || 'General'})`).join('\n')}
`;
    navigator.clipboard.writeText(slackText);
    triggerExportNotification('slack');
  };

  const copyForNotion = () => {
    copyAsMarkdown();
    triggerExportNotification('notion');
  };

  const handleActionToggle = (actionId: string) => {
    toggleActionItem(meeting.id, actionId);
  };

  return (
    <div className="flex-1 h-full bg-white dark:bg-[#0f1117] flex flex-col overflow-hidden select-text">
      {/* Toast Notification for Exports */}
      {copyFeedback && (
        <div className="absolute top-14 right-8 z-50 bg-gray-900 text-white text-xs px-3.5 py-2 rounded-xl shadow-xl border border-white/10 flex items-center gap-2 animate-bounce">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {copyFeedback === 'slack' && '¡Copiado con formato listo para Slack!'}
            {copyFeedback === 'notion' && '¡Estructura lista para pegar en Notion!'}
            {copyFeedback === 'markdown' && '¡Markdown copiado al portapapeles!'}
          </span>
        </div>
      )}

      {/* Header (Cabecera de la Reunión) */}
      <div className="p-6 pb-4 border-b border-black/[0.06] dark:border-white/[0.06] flex-shrink-0 bg-white/50 dark:bg-black/20 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            {/* Template Badge & Category */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${template.badgeColor}`}>
                {template.name}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">
                {meetingDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} • {meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-mono">
                ⏱️ {meeting.durationMinutes} min
              </span>
            </div>

            {/* Title H1 */}
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight leading-snug">
              {meeting.title}
            </h1>

            {/* Participants Avatar Stack */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <User className="w-3 h-3" /> Participantes:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {meeting.participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800/80 border border-black/[0.04] dark:border-white/[0.06] text-xs text-gray-700 dark:text-gray-300"
                  >
                    <img
                      src={p.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&auto=format&fit=crop&q=80'}
                      alt={p.name}
                      className="w-3.5 h-3.5 rounded-full object-cover"
                    />
                    <span className="text-[11px] font-medium">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Export Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={copyForNotion}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-black/10 dark:border-white/10 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-sm transition-all active:scale-95"
              title="Exportar a Notion en bloques limpios"
            >
              <FileText className="w-3.5 h-3.5 text-orange-500" />
              <span>Notion</span>
            </button>

            <button
              onClick={copyForSlack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-black/10 dark:border-white/10 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-sm transition-all active:scale-95"
              title="Enviar a Slack con viñetas y menciones"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
              <span>Slack</span>
            </button>

            <button
              onClick={copyAsMarkdown}
              className="p-1.5 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-300 shadow-sm transition-all"
              title="Copiar Markdown Completo"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2 mt-4 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'summary'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            📌 Resumen & Action Items
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'notes'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            ✏️ Notas Enriquecidas
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'transcript'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            🎙️ Transcripción por Hablantes ({meeting.rawTranscript.length})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === 'summary' && (
          <div className="space-y-6 max-w-4xl">
            {/* 1. Resumen Ejecutivo (Bullets de IA) */}
            <div className="glass-card rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Resumen Ejecutivo</span>
              </div>
              <ul className="space-y-2.5">
                {meeting.executiveSummary.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 2. Action Items con Checkboxes */}
            <div className="glass-card rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tareas y Compromisos ({meeting.actionItems.filter((a) => a.completed).length}/{meeting.actionItems.length})</span>
                </div>
              </div>
              <div className="space-y-2">
                {meeting.actionItems.map((action) => (
                  <div
                    key={action.id}
                    onClick={() => handleActionToggle(action.id)}
                    className={`flex items-start justify-between p-3 rounded-xl transition-all cursor-pointer border ${
                      action.completed
                        ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 text-gray-400 dark:text-gray-500 line-through'
                        : 'bg-white/80 dark:bg-black/30 border-black/[0.06] dark:border-white/[0.08] text-gray-800 dark:text-gray-200 hover:border-indigo-500/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button className="mt-0.5 text-indigo-600 dark:text-indigo-400">
                        {action.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <span className="text-sm font-medium">{action.text}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] flex-shrink-0 font-mono ml-4">
                      {action.assignee && (
                        <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                          @{action.assignee}
                        </span>
                      )}
                      {action.dueDate && (
                        <span className="text-gray-400 dark:text-gray-500">
                          📅 {action.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Decisiones Clave (Key Decisions) */}
            <div className="glass-card rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Tag className="w-4 h-4" />
                <span>Decisiones Tomadas</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {meeting.keyDecisions.map((dec) => (
                  <div
                    key={dec.id}
                    className="p-3.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        {dec.category || 'Acuerdo'}
                      </span>
                    </div>
                    <h5 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {dec.decision}
                    </h5>
                    {dec.rationale && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
                        <em>Motivo: {dec.rationale}</em>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Preguntas sin Resolver (si existen) */}
            {meeting.unresolvedQuestions && meeting.unresolvedQuestions.length > 0 && (
              <div className="glass-card rounded-2xl p-5 shadow-sm space-y-2 border-rose-500/20 bg-rose-500/5">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4" />
                  <span>Puntos sin Resolver</span>
                </div>
                <ul className="list-disc pl-5 text-xs text-gray-700 dark:text-gray-300 space-y-1">
                  {meeting.unresolvedQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="max-w-4xl space-y-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <span>Edita y enriquece las notas de la reunión. Se guardan automáticamente.</span>
              <span className="text-[11px] font-mono text-emerald-500">✓ Guardado en SQLite</span>
            </div>
            <TipTapEditor
              content={meeting.manualNotes}
              onChange={(html) => updateMeeting(meeting.id, { manualNotes: html })}
            />
          </div>
        )}

        {activeTab === 'transcript' && (
          <div className="max-w-4xl space-y-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Haz clic en cualquier segmento para reproducir el audio exacto de ese instante.
            </div>

            <div className="space-y-2">
              {meeting.rawTranscript.map((seg) => {
                const isPlayingHere = currentAudioSec >= seg.timestamp && currentAudioSec <= seg.timestamp + (seg.duration || 5);

                return (
                  <div
                    key={seg.id}
                    onClick={() => setCurrentAudioSec(seg.timestamp)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isPlayingHere
                        ? 'bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/50 shadow-sm'
                        : 'bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 border-black/[0.04] dark:border-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {seg.speaker}
                      </span>
                      <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500">
                        {Math.floor(seg.timestamp / 60)}:{(seg.timestamp % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed">
                      "{seg.text}"
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sticky Audio Player & Waveform */}
      <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.06] bg-white/70 dark:bg-[#12141a]/90 backdrop-blur-md flex-shrink-0">
        <AudioPlayer
          audioUrl={meeting.audioUrl}
          durationSec={meeting.audioDurationSec || 52}
          currentPlaybackTime={currentAudioSec}
          onSeek={(sec) => setCurrentAudioSec(sec)}
        />
      </div>
    </div>
  );
};
