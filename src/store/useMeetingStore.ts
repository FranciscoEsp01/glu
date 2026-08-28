import { create } from 'zustand';
import { Meeting, TemplateType, TranscriptSegment, AISettings } from '../types/meeting';
import { INITIAL_MEETINGS } from '../services/mockData';
import { audioService } from '../services/audioRecorder';
import { AIService } from '../services/aiService';

interface MeetingStoreState {
  // Meetings State
  meetings: Meeting[];
  selectedMeetingId: string | null;
  activeCategory: string; // 'all' | 'today' | 'this_week' | 'sales' | 'one_on_one' | 'engineering' | 'starred'
  searchQuery: string;

  // Live Recording State
  isRecording: boolean;
  isPaused: boolean;
  recordingDurationSeconds: number;
  recordingStartTime: number | null;
  audioLevels: number[];
  rapidNotes: string[];
  currentNoteInput: string;
  recordingTemplate: TemplateType;
  recordingTitle: string;
  liveTranscript: TranscriptSegment[];

  // App UI State
  viewMode: 'main' | 'floating_pill';
  isSettingsOpen: boolean;
  isCommandPaletteOpen: boolean;
  isNewMeetingModalOpen: boolean;
  isProcessingAI: boolean;

  // Settings
  settings: AISettings;

  // Actions
  selectMeeting: (id: string | null) => void;
  setActiveCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: 'main' | 'floating_pill') => void;
  toggleSettings: (open?: boolean) => void;
  toggleCommandPalette: (open?: boolean) => void;
  toggleNewMeetingModal: (open?: boolean) => void;

  // Meeting Management
  addMeeting: (meeting: Meeting) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  deleteMeeting: (id: string) => void;
  toggleStarMeeting: (id: string) => void;
  toggleActionItem: (meetingId: string, actionId: string) => void;

  // Recording Controls
  startRecording: (template?: TemplateType, customTitle?: string) => Promise<void>;
  stopRecordingAndProcess: () => Promise<void>;
  cancelRecording: () => void;
  addRapidNote: (note: string) => void;
  setCurrentNoteInput: (val: string) => void;
  setRecordingTemplate: (t: TemplateType) => void;
  setRecordingTitle: (title: string) => void;

  // Settings update
  updateSettings: (updates: Partial<AISettings>) => void;
}

const STORAGE_KEY = 'glu_meetings_data_v1';
const SETTINGS_KEY = 'glu_settings_v1';

const getInitialMeetings = (): Meeting[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error cargando reuniones guardadas:', e);
  }
  return INITIAL_MEETINGS;
};

const getInitialSettings = (): AISettings => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error cargando configuración:', e);
  }
  return {
    geminiApiKey: '',
    deepgramApiKey: '',
    openaiApiKey: '',
    selectedModel: 'gemini-2.0-flash',
    useMockEngine: true,
    saveLocalAudio: true,
    theme: 'dark',
    preferredLanguage: 'es',
  };
};

let recordingTimerInterval: any = null;

export const useMeetingStore = create<MeetingStoreState>((set, get) => ({
  meetings: getInitialMeetings(),
  selectedMeetingId: getInitialMeetings()[0]?.id || null,
  activeCategory: 'all',
  searchQuery: '',

  isRecording: false,
  isPaused: false,
  recordingDurationSeconds: 0,
  recordingStartTime: null,
  audioLevels: [0.2, 0.4, 0.6, 0.3, 0.7, 0.5, 0.4, 0.6, 0.3, 0.5, 0.4, 0.3],
  rapidNotes: [],
  currentNoteInput: '',
  recordingTemplate: 'general',
  recordingTitle: '',
  liveTranscript: [],

  viewMode: 'main',
  isSettingsOpen: false,
  isCommandPaletteOpen: false,
  isNewMeetingModalOpen: false,
  isProcessingAI: false,

  settings: getInitialSettings(),

  selectMeeting: (id) => set({ selectedMeetingId: id }),
  setActiveCategory: (category) => set({ activeCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleSettings: (open) => set((s) => ({ isSettingsOpen: open !== undefined ? open : !s.isSettingsOpen })),
  toggleCommandPalette: (open) => set((s) => ({ isCommandPaletteOpen: open !== undefined ? open : !s.isCommandPaletteOpen })),
  toggleNewMeetingModal: (open) => set((s) => ({ isNewMeetingModalOpen: open !== undefined ? open : !s.isNewMeetingModalOpen })),

  addMeeting: (meeting) => {
    set((state) => {
      const updated = [meeting, ...state.meetings];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return { meetings: updated, selectedMeetingId: meeting.id };
    });
  },

  updateMeeting: (id, updates) => {
    set((state) => {
      const updated = state.meetings.map((m) => (m.id === id ? { ...m, ...updates } : m));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return { meetings: updated };
    });
  },

  deleteMeeting: (id) => {
    set((state) => {
      const updated = state.meetings.filter((m) => m.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      const nextSelected = updated.length > 0 ? updated[0].id : null;
      return { meetings: updated, selectedMeetingId: nextSelected };
    });
  },

  toggleStarMeeting: (id) => {
    set((state) => {
      const updated = state.meetings.map((m) => (m.id === id ? { ...m, isStarred: !m.isStarred } : m));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return { meetings: updated };
    });
  },

  toggleActionItem: (meetingId, actionId) => {
    set((state) => {
      const updated = state.meetings.map((m) => {
        if (m.id !== meetingId) return m;
        const newActions = m.actionItems.map((a) =>
          a.id === actionId ? { ...a, completed: !a.completed } : a
        );
        return { ...m, actionItems: newActions };
      });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return { meetings: updated };
    });
  },

  startRecording: async (template = 'general', customTitle) => {
    if (recordingTimerInterval) clearInterval(recordingTimerInterval);

    const title = customTitle || `Reunión ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    set({
      isRecording: true,
      isPaused: false,
      recordingDurationSeconds: 0,
      recordingStartTime: Date.now(),
      rapidNotes: [],
      currentNoteInput: '',
      recordingTemplate: template,
      recordingTitle: title,
      liveTranscript: [],
    });

    recordingTimerInterval = setInterval(() => {
      set((s) => ({ recordingDurationSeconds: s.recordingDurationSeconds + 1 }));
    }, 1000);

    await audioService.startRecording(
      (levels) => {
        set({ audioLevels: levels });
      },
      (chunk) => {
        set((s) => ({ liveTranscript: [...s.liveTranscript, chunk] }));
      }
    );
  },

  stopRecordingAndProcess: async () => {
    if (recordingTimerInterval) {
      clearInterval(recordingTimerInterval);
      recordingTimerInterval = null;
    }

    const {
      recordingTemplate,
      recordingTitle,
      rapidNotes,
      liveTranscript,
      recordingDurationSeconds,
      settings,
    } = get();

    set({ isRecording: false, isProcessingAI: true });

    // Detener grabación de audio
    const recordingResult = await audioService.stopRecording();

    // Fallback transcript si fue una reunión muy corta
    let finalTranscript = recordingResult.transcript;
    if (finalTranscript.length === 0 && liveTranscript.length > 0) {
      finalTranscript = liveTranscript;
    }
    if (finalTranscript.length === 0) {
      finalTranscript = [
        {
          id: `seg-default-1`,
          speaker: 'Francisco (Host)',
          text: 'Iniciamos la reunión para revisar los objetivos del proyecto y definir los entregables inmediatos.',
          timestamp: 0,
          duration: 5,
        },
        {
          id: `seg-default-2`,
          speaker: 'Participante',
          text: 'Confirmamos que los módulos de la base de datos y la interfaz de usuario están aprobados.',
          timestamp: 6,
          duration: 7,
        },
      ];
    }

    const durationMin = Math.max(1, Math.ceil(recordingDurationSeconds / 60));

    // Procesar con IA (Gemini / Claude / local)
    const aiResult = await AIService.processMeeting(
      {
        title: recordingTitle,
        templateType: recordingTemplate,
        transcript: finalTranscript,
        rapidNotes,
        manualNotes: '',
        durationMinutes: durationMin,
      },
      settings.geminiApiKey
    );

    const newMeeting: Meeting = {
      id: `meet-${Date.now()}`,
      title: aiResult.title || recordingTitle,
      date: new Date().toISOString(),
      durationMinutes: durationMin,
      templateType: recordingTemplate,
      category: 'today',
      tags: ['Nueva', recordingTemplate],
      participants: [
        {
          id: 'p-me',
          name: 'Tú (Host)',
          role: 'Organizador',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        },
        {
          id: 'p-guest',
          name: 'Participante',
          role: 'Invitado',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
        },
      ],
      executiveSummary: aiResult.executiveSummary,
      actionItems: aiResult.actionItems,
      keyDecisions: aiResult.keyDecisions,
      unresolvedQuestions: aiResult.unresolvedQuestions,
      rawTranscript: finalTranscript,
      manualNotes: aiResult.enrichedNotes,
      audioUrl: recordingResult.audioUrl,
      audioDurationSec: recordingResult.durationSec,
      isStarred: false,
    };

    get().addMeeting(newMeeting);

    set({
      isProcessingAI: false,
      viewMode: 'main',
      selectedMeetingId: newMeeting.id,
      rapidNotes: [],
      currentNoteInput: '',
      liveTranscript: [],
    });
  },

  cancelRecording: () => {
    if (recordingTimerInterval) {
      clearInterval(recordingTimerInterval);
      recordingTimerInterval = null;
    }
    audioService.stopRecording();
    set({
      isRecording: false,
      isPaused: false,
      recordingDurationSeconds: 0,
      rapidNotes: [],
      currentNoteInput: '',
      liveTranscript: [],
    });
  },

  addRapidNote: (note: string) => {
    if (!note.trim()) return;
    set((s) => ({
      rapidNotes: [...s.rapidNotes, note.trim()],
      currentNoteInput: '',
    }));
  },

  setCurrentNoteInput: (val) => set({ currentNoteInput: val }),
  setRecordingTemplate: (t) => set({ recordingTemplate: t }),
  setRecordingTitle: (title) => set({ recordingTitle: title }),

  updateSettings: (updates) => {
    set((state) => {
      const next = { ...state.settings, ...updates };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch (e) {}
      return { settings: next };
    });
  },
}));
