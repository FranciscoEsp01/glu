import { managedTranscription } from '../services/managed-transcription';
import {
  ProcessingError,
  isJobPending,
  retryJob,
  type ProcessingJob,
} from '../services/processing-state';
import { accountKey } from '../services/account';
import { billingRequest } from '../services/billing';
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
  runProcessingJobs: () => Promise<void>;
  cancelProcessingJob: (id: string) => Promise<void>;
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
export async function flushMeetings() {
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
    await flushMeetings();
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
    if (get().isRecording || get().isStarting) return;
    const meeting = get().meetings.find((m) => m.id === id);
    if (!meeting || isJobPending(meeting.processingJob)) return;
    const previous = meeting.processingJob;
    const now = new Date().toISOString();
    const resume = previous && ['blocked', 'failed'].includes(previous.state);
    const job: ProcessingJob = resume
      ? {
          ...previous,
          state: 'queued',
          attempts: 0,
          nextAttemptAt: undefined,
          requestId: previous.newOperation ? crypto.randomUUID() : previous.requestId,
          operationStartedAt: previous.newOperation ? undefined : previous.operationStartedAt,
          error: undefined,
          updatedAt: now,
        }
      : {
          id: crypto.randomUUID(),
          state: 'queued',
          stage: !meeting.rawTranscript.length && meeting.hasAudio ? 'transcription' : 'summary',
          requestId: crypto.randomUUID(),
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          nextChunk: 0,
          partialTranscript: [],
          payload: {
            title: meeting.title,
            templateType: meeting.templateType,
            transcript: meeting.rawTranscript,
            manualNotes: meeting.manualNotes,
            rapidNotes: meeting.originalNotes ? [meeting.originalNotes] : [],
            durationMinutes: meeting.durationMinutes,
          },
          settings: {
            preferredLanguage: get().settings.preferredLanguage,
            saveLocalAudio: get().settings.saveLocalAudio,
          },
        };
    get().updateMeeting(id, { processingJob: job, status: 'pending', error: undefined });
    try {
      await flushMeetings();
      await get().runProcessingJobs();
    } catch (e) {
      set({ error: errorText(e) });
    }
  },
  cancelProcessingJob: async (id) => {
    const job = get().meetings.find((m) => m.id === id)?.processingJob;
    if (!job || get().isProcessingAI || job.state === 'succeeded') return;
    get().updateMeeting(id, {
      processingJob: { ...job, state: 'canceled', updatedAt: new Date().toISOString() },
      status: 'pending',
      error: undefined,
    });
    try {
      await flushMeetings();
    } catch (e) {
      set({ error: errorText(e) });
    }
  },
  runProcessingJobs: async () => {
    if (
      !get().initialized ||
      get().isProcessingAI ||
      get().isStarting ||
      get().isRecording ||
      !navigator.onLine
    )
      return;
    if (
      !get().meetings.some(
        (m) =>
          isJobPending(m.processingJob) &&
          (!m.processingJob?.nextAttemptAt ||
            Date.parse(m.processingJob.nextAttemptAt) <= Date.now()),
      )
    )
      return;
    set({ isProcessingAI: true });
    const work = async () => {
      await flushMeetings();
      // Read checkpoints again under the runner lock so another window's completion is respected.
      const snapshot = get().meetings;
      const loaded = await storage.load();
      const meetings = get().meetings === snapshot ? loaded : get().meetings;
      set({ meetings });
      const meeting = [...meetings]
        .sort(
          (a, b) =>
            Date.parse(a.processingJob?.createdAt || a.date) -
            Date.parse(b.processingJob?.createdAt || b.date),
        )
        .find(
          (m) =>
            isJobPending(m.processingJob) &&
            (!m.processingJob?.nextAttemptAt ||
              Date.parse(m.processingJob.nextAttemptAt) <= Date.now()),
        );
      if (!meeting?.processingJob) return;
      const id = meeting.id;
      let job: ProcessingJob = {
        ...meeting.processingJob,
        state: 'running',
        operationStartedAt: meeting.processingJob.operationStartedAt || new Date().toISOString(),
        nextAttemptAt: undefined,
        updatedAt: new Date().toISOString(),
      };
      const checkpoint = async (
        changes: Partial<ProcessingJob>,
        updates: Partial<Meeting> = {},
      ) => {
        job = { ...job, ...changes, updatedAt: new Date().toISOString() };
        get().updateMeeting(id, { ...updates, processingJob: job });
        await flushMeetings();
      };
      try {
        await checkpoint({}, { status: 'processing', error: undefined });
        if (job.stage === 'summary' && !meeting.processingJob.operationStartedAt)
          await billingRequest('billing', { action: 'authorize', feature: 'summary' });
        if (job.stage === 'transcription') {
          // Prevent spending audio minutes when the account cannot generate summaries.
          await billingRequest('billing', { action: 'authorize', feature: 'summary' });
          const blob = await storage.getAudio(id);
          if (!blob)
            throw new ProcessingError(
              'El audio no está disponible. Puedes pegar una transcripción.',
              'missing_audio',
            );
          const rawTranscript = await managedTranscription(blob, job.settings.preferredLanguage, {
            nextChunk: job.nextChunk,
            partial: job.partialTranscript,
            requestId: async () => {
              if (!job.operationStartedAt)
                await checkpoint({ operationStartedAt: new Date().toISOString() });
              return job.requestId;
            },
            save: async (nextChunk, totalChunks, partialTranscript) =>
              checkpoint({
                nextChunk,
                totalChunks,
                partialTranscript,
                attempts: 0,
                requestId: crypto.randomUUID(),
                operationStartedAt: undefined,
              }),
          });
          await checkpoint(
            {
              stage: 'summary',
              payload: { ...job.payload, transcript: rawTranscript },
              partialTranscript: [],
              attempts: 0,
              requestId: crypto.randomUUID(),
              operationStartedAt: undefined,
            },
            {
              rawTranscript,
              participants: [...new Set(rawTranscript.map((t) => t.speaker))].map((name) => ({
                id: name,
                name,
              })),
            },
          );
        }
        if (!job.operationStartedAt)
          await checkpoint({ operationStartedAt: new Date().toISOString() });
        const result = await AIService.processMeeting(job.payload, job.settings, job.requestId);
        await checkpoint(
          { state: 'succeeded', error: undefined, code: undefined, newOperation: false },
          {
            originalNotes:
              meeting.originalNotes || job.payload.manualNotes.replace(/<[^>]+>/g, ' '),
            title: result.title || meeting.title,
            executiveSummary: result.executiveSummary,
            actionItems: result.actionItems,
            keyDecisions: result.keyDecisions,
            unresolvedQuestions: result.unresolvedQuestions,
            manualNotes: result.enrichedNotes,
            status: 'ready',
            error: undefined,
          },
        );
        if (!job.settings.saveLocalAudio && meeting.hasAudio) {
          try {
            await storage.deleteAudio(id);
            get().updateMeeting(id, { hasAudio: false });
            await flushMeetings();
          } catch {
            set({ error: 'El resumen está guardado, pero no se pudo eliminar el audio local.' });
          }
        }
      } catch (e) {
        const next = retryJob(job, e);
        // A failed local write stops the runner before any further paid request.
        await checkpoint(next, {
          status: next.state === 'retry_wait' ? 'pending' : 'error',
          error: next.error,
        });
        if (next.state !== 'retry_wait') set({ error: next.error });
      }
    };
    try {
      if (navigator.locks)
        await navigator.locks.request(
          accountKey('glu-processing'),
          { ifAvailable: true },
          async (lock) => {
            if (lock) await work();
          },
        );
      else await work();
    } catch (e) {
      set({ error: `No pudimos guardar el trabajo: ${errorText(e)}` });
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
