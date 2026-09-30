import { create } from 'zustand';
import { Meeting, TemplateType, TranscriptSegment, AISettings } from '../types/meeting';
import { audioService } from '../services/audioRecorder';
import { AIService } from '../services/aiService';
import { storage } from '../services/storage';
import { RecordingClock } from '../services/recordingClock';
import { desktop, invoke, errorText, escapeHtml } from '../lib/platform';
interface MeetingStoreState {
  isKnowledgeOpen: boolean;
  isBackupOpen: boolean;
  toggleKnowledge: (open: boolean) => void;
  toggleBackup: (open: boolean) => void;
  restoreHistory: (meetings: Meeting[]) => Promise<void>;
  meetings: Meeting[];
  selectedMeetingId: string | null;
  activeCategory: string;
  searchQuery: string;
  isRecording: boolean;
  isStarting: boolean;
  isPaused: boolean;
  recordingDurationSeconds: number;
  recordingStartTime: number | null;
  audioLevels: number[];
  rapidNotes: string[];
  currentNoteInput: string;
  recordingTemplate: TemplateType;
  recordingTitle: string;
  liveTranscript: TranscriptSegment[];
  viewMode: 'main' | 'floating_pill';
  isSettingsOpen: boolean;
  isCommandPaletteOpen: boolean;
  isNewMeetingModalOpen: boolean;
  isProcessingAI: boolean;
  settings: AISettings;
  initialized: boolean;
  error: string | null;
  recordingId: string | null;
  initialize: () => Promise<void>;
  clearError: () => void;
  selectMeeting: (id: string | null) => void;
  setActiveCategory: (s: string) => void;
  setSearchQuery: (s: string) => void;
  setViewMode: (s: 'main' | 'floating_pill') => void;
  toggleSettings: (s?: boolean) => void;
  toggleCommandPalette: (s?: boolean) => void;
  toggleNewMeetingModal: (s?: boolean) => void;
  addMeeting: (m: Meeting) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  deleteMeeting: (id: string) => Promise<void>;
  toggleStarMeeting: (id: string) => void;
  toggleActionItem: (id: string, action: string) => void;
  startRecording: (template?: TemplateType, title?: string) => Promise<void>;
  stopRecordingAndProcess: () => Promise<void>;
  cancelRecording: () => Promise<void>;
  processMeeting: (id: string) => Promise<void>;
  importMeeting: (text: string, audio?: File) => Promise<void>;
  addRapidNote: (s: string) => void;
  setCurrentNoteInput: (s: string) => void;
  setRecordingTemplate: (s: TemplateType) => void;
  setRecordingTitle: (s: string) => void;
  togglePauseRecording: () => Promise<void>;
  updateSettings: (s: Partial<AISettings>) => Promise<void>;
}
const recordingClock = new RecordingClock();
let timer: ReturnType<typeof setInterval> | undefined;
let persistQueue = Promise.resolve();
let persistenceError: unknown;
async function flushed() {
  await persistQueue;
  if (persistenceError) throw persistenceError;
}
let initialization: Promise<void> | undefined;
const fresh = (title: string, template: TemplateType = 'general'): Meeting => ({
  id: crypto.randomUUID(),
  title,
  date: new Date().toISOString(),
  durationMinutes: 0,
  templateType: template,
  participants: [],
  executiveSummary: [],
  actionItems: [],
  keyDecisions: [],
  rawTranscript: [],
  manualNotes: '',
  tags: [],
  category: 'today',
  status: 'pending',
});
function persist() {
  const snapshot = useMeetingStore.getState().meetings;
  persistQueue = persistQueue
    .then(async () => {
      await storage.save(snapshot);
      persistenceError = undefined;
    })
    .catch((e) => {
      persistenceError = e;
      useMeetingStore.setState({ error: `No se pudo guardar el historial: ${errorText(e)}` });
    });
}
export const useMeetingStore = create<MeetingStoreState>((set, get) => ({
  isKnowledgeOpen: false,
  isBackupOpen: false,
  toggleKnowledge: (isKnowledgeOpen) => set({ isKnowledgeOpen }),
  toggleBackup: (isBackupOpen) => set({ isBackupOpen }),
  restoreHistory: async (meetings) => {
    if (get().isRecording || get().isProcessingAI || get().isStarting)
      throw new Error('Finaliza la reunión activa antes de restaurar.');
    await flushed();
    await storage.save(meetings);
    set({ meetings, selectedMeetingId: get().selectedMeetingId || meetings[0]?.id || null });
  },
  meetings: [],
  selectedMeetingId: null,
  activeCategory: 'all',
  searchQuery: '',
  isRecording: false,
  isStarting: false,
  isPaused: false,
  recordingDurationSeconds: 0,
  recordingStartTime: null,
  audioLevels: Array(12).fill(0),
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
  initialized: false,
  error: null,
  recordingId: null,
  settings: {
    geminiApiKey: '',
    deepgramApiKey: '',
    selectedModel: 'gemini-2.5-flash',
    saveLocalAudio: false,
    theme: 'light',
    preferredLanguage: 'es',
    captureSource: 'microphone',
  },
  initialize: () =>
    (initialization ??= (async () => {
      try {
        const meetings = await storage.load();
        set({ meetings, selectedMeetingId: meetings[0]?.id ?? null });
        const settings = await storage.loadSettings();
        set({ settings });
      } catch (e) {
        set({ error: errorText(e) });
      } finally {
        set({ initialized: true });
      }
    })()),
  clearError: () => set({ error: null }),
  selectMeeting: (id) => set({ selectedMeetingId: id }),
  setActiveCategory: (activeCategory) => set({ activeCategory }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setViewMode: (viewMode) => {
    set({ viewMode });
    if (desktop())
      void invoke('set_compact', { compact: viewMode === 'floating_pill' }).catch((e) =>
        set({ error: errorText(e) }),
      );
  },
  toggleSettings: (v) => set((s) => ({ isSettingsOpen: v ?? !s.isSettingsOpen })),
  toggleCommandPalette: (v) => set((s) => ({ isCommandPaletteOpen: v ?? !s.isCommandPaletteOpen })),
  toggleNewMeetingModal: (v) =>
    set((s) => ({ isNewMeetingModalOpen: v ?? !s.isNewMeetingModalOpen })),
  addMeeting: (m) => {
    set((s) => ({ meetings: [m, ...s.meetings], selectedMeetingId: m.id }));
    persist();
  },
  updateMeeting: (id, updates) => {
    set((s) => ({ meetings: s.meetings.map((m) => (m.id === id ? { ...m, ...updates } : m)) }));
    persist();
  },
  deleteMeeting: async (id) => {
    if (get().isProcessingAI || id === get().recordingId) return;
    try {
      await storage.deleteAudio(id);
      set((s) => ({
        meetings: s.meetings.filter((m) => m.id !== id),
        selectedMeetingId:
          s.selectedMeetingId === id
            ? (s.meetings.find((m) => m.id !== id)?.id ?? null)
            : s.selectedMeetingId,
      }));
      persist();
    } catch (e) {
      set({ error: errorText(e) });
    }
  },
  toggleStarMeeting: (id) => {
    const m = get().meetings.find((m) => m.id === id);
    if (m) get().updateMeeting(id, { isStarred: !m.isStarred });
  },
  toggleActionItem: (id, action) => {
    const m = get().meetings.find((m) => m.id === id);
    if (m)
      get().updateMeeting(id, {
        actionItems: m.actionItems.map((a) =>
          a.id === action ? { ...a, completed: !a.completed } : a,
        ),
      });
  },
  startRecording: async (template = 'general', title) => {
    if (get().isRecording || get().isStarting || get().isProcessingAI || !get().initialized) return;
    set({ isStarting: true, error: null });
    const meeting = fresh(title || `Reunión ${new Date().toLocaleString('es-CL')}`, template);
    try {
      // Save metadata before requesting capture so interrupted sessions remain discoverable.
      await storage.save([meeting, ...get().meetings]);
      await audioService.startRecording(
        meeting.id,
        get().settings.captureSource,
        (audioLevels) => set({ audioLevels }),
        (error) => set({ error }),
      );
      recordingClock.start();
      meeting.status = 'recording';
      meeting.hasAudio = true;
      get().addMeeting(meeting);
      set({
        isRecording: true,
        isStarting: false,
        isPaused: false,
        recordingId: meeting.id,
        recordingDurationSeconds: 0,
        recordingStartTime: Date.now(),
        rapidNotes: [],
        currentNoteInput: '',
        recordingTemplate: template,
        recordingTitle: meeting.title,
        isNewMeetingModalOpen: false,
      });
      timer = setInterval(() => {
        if (get().isPaused) return;
        const duration = recordingClock.seconds();
        set({ recordingDurationSeconds: duration });
        if (duration % 5 === 0)
          get().updateMeeting(meeting.id, {
            audioDurationSec: duration,
            durationMinutes: Math.ceil(duration / 60),
          });
      }, 1000);
    } catch (e) {
      set({ isStarting: false, error: `No se pudo iniciar: ${errorText(e)}` });
      await storage.save(get().meetings).catch(() => {});
      get().setViewMode('main');
    }
  },
  stopRecordingAndProcess: async () => {
    const { recordingId, isRecording, currentNoteInput } = get();
    if (!isRecording || !recordingId) return;
    clearInterval(timer);
    const recordingDurationSeconds = recordingClock.stop();
    set({ isRecording: false, isStarting: true, recordingDurationSeconds });
    if (currentNoteInput.trim()) get().addRapidNote(currentNoteInput);
    try {
      await audioService.stopRecording();
      get().updateMeeting(recordingId, {
        status: 'pending',
        hasAudio: true,
        audioDurationSec: recordingDurationSeconds,
        durationMinutes: Math.ceil(recordingDurationSeconds / 60),
      });
    } catch (e) {
      get().updateMeeting(recordingId, { status: 'error', error: errorText(e) });
      set({ error: errorText(e) });
    } finally {
      set({ isStarting: false, isPaused: false, recordingId: null });
      get().setViewMode('main');
    }
    await persistQueue;
    if (get().meetings.find((m) => m.id === recordingId)?.status !== 'error')
      await get().processMeeting(recordingId);
  },
  cancelRecording: async () => {
    await get().stopRecordingAndProcess();
  },
  processMeeting: async (id) => {
    if (get().isProcessingAI || get().isRecording || get().isStarting) return;
    let meeting = get().meetings.find((m) => m.id === id);
    if (!meeting) return;
    set({ isProcessingAI: true, error: null });
    get().updateMeeting(id, { status: 'processing', error: undefined });
    try {
      const settings = { ...get().settings };
      if (!meeting.rawTranscript.length && meeting.hasAudio) {
        const blob = desktop() ? undefined : await storage.getAudio(id);
        if (!desktop() && !blob)
          throw new Error('El audio no está disponible. Puedes pegar una transcripción.');
        const rawTranscript = await AIService.transcribe(id, blob, settings);
        get().updateMeeting(id, {
          rawTranscript,
          participants: [...new Set(rawTranscript.map((t) => t.speaker))].map((name) => ({
            id: name,
            name,
          })),
        });
        meeting = { ...meeting, rawTranscript };
      }
      const result = await AIService.processMeeting(
        {
          title: meeting.title,
          templateType: meeting.templateType,
          transcript: meeting.rawTranscript,
          manualNotes: meeting.manualNotes,
          rapidNotes: meeting.originalNotes ? [meeting.originalNotes] : [],
          durationMinutes: meeting.durationMinutes,
        },
        settings,
      );
      get().updateMeeting(id, {
        originalNotes: meeting.originalNotes || meeting.manualNotes.replace(/<[^>]+>/g, ' '),
        title: result.title || meeting.title,
        executiveSummary: result.executiveSummary,
        actionItems: result.actionItems,
        keyDecisions: result.keyDecisions,
        unresolvedQuestions: result.unresolvedQuestions,
        manualNotes: result.enrichedNotes,
        status: 'ready',
        error: undefined,
      });
      await flushed();
      if (!settings.saveLocalAudio && meeting.hasAudio) {
        await storage.deleteAudio(id);
        get().updateMeeting(id, { hasAudio: false });
      }
    } catch (e) {
      get().updateMeeting(id, { status: 'error', error: errorText(e) });
      set({ error: errorText(e) });
    } finally {
      set({ isProcessingAI: false });
    }
  },
  importMeeting: async (text, audio) => {
    if (get().isProcessingAI || get().isRecording || get().isStarting) return;
    try {
      const meeting = fresh(audio?.name.replace(/\.[^.]+$/, '') || 'Reunión importada');
      if (audio) {
        await storage.putAudio(meeting.id, audio);
        meeting.hasAudio = true;
      }
      if (text.trim())
        meeting.rawTranscript = [
          {
            id: crypto.randomUUID(),
            speaker: 'Transcripción importada',
            text: text.trim(),
            timestamp: 0,
          },
        ];
      get().addMeeting(meeting);
      await persistQueue;
    } catch (e) {
      set({ error: errorText(e) });
    }
  },
  addRapidNote: (note) => {
    if (!note.trim()) return;
    const notes = [...get().rapidNotes, note.trim()];
    set({ rapidNotes: notes, currentNoteInput: '' });
    const id = get().recordingId;
    if (id)
      get().updateMeeting(id, {
        originalNotes: notes.join('\n'),
        manualNotes: notes.map((n) => `<p>${escapeHtml(n)}</p>`).join(''),
      });
  },
  setCurrentNoteInput: (currentNoteInput) => set({ currentNoteInput }),
  setRecordingTemplate: (recordingTemplate) => set({ recordingTemplate }),
  setRecordingTitle: (recordingTitle) => set({ recordingTitle }),
  togglePauseRecording: async () => {
    if (!get().isRecording) return;
    try {
      const paused = !get().isPaused;
      await audioService.pause(paused);
      if (paused) recordingClock.pause();
      else recordingClock.resume();
      set({ isPaused: paused });
    } catch (e) {
      set({ error: errorText(e) });
    }
  },
  updateSettings: async (updates) => {
    const settings = { ...get().settings, ...updates };
    try {
      await storage.saveSettings(settings);
      set({ settings, isSettingsOpen: false });
    } catch (e) {
      set({ error: `No se pudo guardar la configuración: ${errorText(e)}` });
    }
  },
}));
