import React, { useState } from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { MEETING_TEMPLATES } from '../services/templates';
import { TemplateType } from '../types/meeting';
import { 
  X, 
  Mic, 
  TrendingUp, 
  Users, 
  Compass, 
  Cpu, 
  FileText,
  Layers,
  Check
} from 'lucide-react';

export const NewMeetingModal: React.FC = () => {
  const {
    isNewMeetingModalOpen,
    toggleNewMeetingModal,
    startRecording,
    setViewMode,
  } = useMeetingStore();

  const [title, setTitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('general');
  const [startAsFloatingPill, setStartAsFloatingPill] = useState(true);

  if (!isNewMeetingModalOpen) return null;

  const iconMap: Record<string, any> = {
    FileText,
    TrendingUp,
    Users,
    Compass,
    Cpu,
  };

  const handleStart = async () => {
    const finalTitle = title.trim() || `Reunión de ${MEETING_TEMPLATES[selectedTemplate].name}`;
    toggleNewMeetingModal(false);
    
    if (startAsFloatingPill) {
      setViewMode('floating_pill');
    }
    
    await startRecording(selectedTemplate, finalTitle);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white dark:bg-[#161820] rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Iniciar Nueva Reunión con IA
              </h3>
              <p className="text-[11px] text-gray-400">
                Selecciona la plantilla adecuada para el tipo de conversación
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleNewMeetingModal(false)}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Title Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-800 dark:text-gray-200">
              Título o Asunto de la Reunión (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Sync de Producto, Demo con Cliente, 1-on-1..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-9 px-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/10 dark:border-white/10 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Template Card Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-800 dark:text-gray-200">
              Plantilla de Especialización
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {Object.values(MEETING_TEMPLATES).map((tmpl) => {
                const IconComponent = iconMap[tmpl.icon] || FileText;
                const isSelected = selectedTemplate === tmpl.id;

                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                        : 'bg-white dark:bg-[#1f222b] hover:bg-gray-50 dark:hover:bg-[#252833] border-black/[0.06] dark:border-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${tmpl.badgeColor}`}>
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                          {tmpl.name}
                        </h4>
                      </div>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-normal line-clamp-2">
                      {tmpl.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Floating Pill Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06]">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
              <Layers className="w-4 h-4 text-indigo-500" />
              <div>
                <p className="font-semibold">Iniciar en Cápsula Flotante (Floating Pill)</p>
                <p className="text-[10px] text-gray-400">Minimiza la app para no estorbar tu videollamada</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={startAsFloatingPill}
              onChange={(e) => setStartAsFloatingPill(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
          <button
            onClick={() => toggleNewMeetingModal(false)}
            className="px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-xs text-gray-500 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all active:scale-95"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Iniciar Grabación Ahora</span>
          </button>
        </div>
      </div>
    </div>
  );
};
