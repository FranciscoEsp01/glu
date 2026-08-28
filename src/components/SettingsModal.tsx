import React, { useState } from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { 
  X, 
  Key, 
  ShieldCheck, 
  Volume2, 
  Sparkles, 
  Bot,
  Check, 
  ExternalLink,
  Info
} from 'lucide-react';

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, toggleSettings, settings, updateSettings } = useMeetingStore();

  const [geminiKey, setGeminiKey] = useState(settings.geminiApiKey);
  const [deepgramKey, setDeepgramKey] = useState(settings.deepgramApiKey);
  const [openaiKey, setOpenaiKey] = useState(settings.openaiApiKey);
  const [useMock, setUseMock] = useState(settings.useMockEngine);
  const [saveAudio, setSaveAudio] = useState(settings.saveLocalAudio);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isSettingsOpen) return null;

  const handleSave = () => {
    updateSettings({
      geminiApiKey: geminiKey,
      deepgramApiKey: deepgramKey,
      openaiApiKey: openaiKey,
      useMockEngine: useMock,
      saveLocalAudio: saveAudio,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      toggleSettings(false);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-white dark:bg-[#161820] rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Configuración y Privacidad
              </h3>
              <p className="text-[11px] text-gray-400">
                Ajusta los motores de IA y políticas de audio
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleSettings(false)}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Tabs / Forms */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* 1. Gemini API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Google Gemini API Key (Recomendado)</span>
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
              >
                <span>Obtener Key gratis</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="w-full h-9 px-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/10 dark:border-white/10 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
            <p className="text-[10px] text-gray-400">
              Permite resúmenes instantáneos con Gemini 2.0 Flash. Si está vacía, se usa el motor sintético local.
            </p>
          </div>

          {/* 2. Deepgram STT Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Deepgram Nova API Key (STT en Vivo)</span>
              </label>
              <a
                href="https://deepgram.com"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
              >
                <span>$200 créditos gratis</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input
              type="password"
              placeholder="dg_..."
              value={deepgramKey}
              onChange={(e) => setDeepgramKey(e.target.value)}
              className="w-full h-9 px-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/10 dark:border-white/10 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
            />
          </div>

          {/* 3. OpenAI / Claude Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-purple-500" />
              <span>OpenAI API Key (Opcional)</span>
            </label>
            <input
              type="password"
              placeholder="sk-..."
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              className="w-full h-9 px-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/10 dark:border-white/10 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
            />
          </div>

          {/* 4. Local Audio Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06]">
            <div className="text-xs text-gray-700 dark:text-gray-300">
              <p className="font-semibold">Guardar audio original localmente</p>
              <p className="text-[10px] text-gray-400">Guarda archivo .wav local para reproducir citas exactas</p>
            </div>
            <input
              type="checkbox"
              checked={saveAudio}
              onChange={(e) => setSaveAudio(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* 5. Fallback Mock Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06]">
            <div className="text-xs text-gray-700 dark:text-gray-300">
              <p className="font-semibold">Modo Demo / Simulación instantánea</p>
              <p className="text-[10px] text-gray-400">Permite probar la app sin consumir saldo de API keys</p>
            </div>
            <input
              type="checkbox"
              checked={useMock}
              onChange={(e) => setUseMock(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* 3. Privacy & Zero Audio Retention */}
          <div className="p-3.5 rounded-xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Arquitectura Zero-Audio Retention & GDPR</span>
            </div>
            <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
              Tus reuniones y transcripciones se procesan en memoria y se almacenan exclusivamente de forma local en tu máquina. Ningún audio es usado para entrenar modelos.
            </p>
          </div>

          {/* 4. Audio Engine Info */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06]">
            <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-1">
              <p className="font-semibold text-gray-700 dark:text-gray-300">Captura de Audio Dual Nativa:</p>
              <p>• <strong>macOS</strong>: ScreenCaptureKit loopback + Micrófono físico.</p>
              <p>• <strong>Windows</strong>: WASAPI Loopback 16kHz.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
          <span className="text-[11px] text-gray-400">Tus datos nunca salen de tu dispositivo.</span>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all active:scale-95"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>¡Guardado!</span>
              </>
            ) : (
              <span>Guardar Cambios</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
