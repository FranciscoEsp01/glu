export type TemplateType = 'general' | 'sales' | 'one_on_one' | 'ux_research' | 'standup';

export interface Participant {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
}

export interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
  assignee?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface KeyDecision {
  id: string;
  decision: string;
  rationale?: string;
  category?: string;
}

export interface TranscriptSegment {
  id: string;
  speaker: string; // e.g. "Francisco (Host)", "Clara", "Speaker 1"
  text: string;
  timestamp: number; // in seconds
  duration?: number;
}

export interface Meeting {
  id: string;
  title: string;
  date: string; // ISO string
  durationMinutes: number;
  templateType: TemplateType;
  participants: Participant[];
  executiveSummary: string[];
  actionItems: ActionItem[];
  keyDecisions: KeyDecision[];
  unresolvedQuestions?: string[];
  rawTranscript: TranscriptSegment[];
  manualNotes: string; // Rich text / TipTap HTML / markdown
  audioUrl?: string; // Local object URL or mock audio
  audioDurationSec?: number;
  tags: string[];
  category: 'today' | 'this_week' | 'sales' | 'one_on_one' | 'engineering' | 'archived';
  isStarred?: boolean;
}

export interface TemplateDefinition {
  id: TemplateType;
  name: string;
  icon: string;
  description: string;
  badgeColor: string;
  systemPrompt: string;
  defaultSections: string[];
}

export interface AudioRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  durationSeconds: number;
  audioLevels: number[];
  currentNote: string;
  rapidNotes: string[];
  selectedTemplate: TemplateType;
  meetingTitle: string;
}

export interface AISettings {
  geminiApiKey: string;
  deepgramApiKey: string;
  openaiApiKey: string;
  selectedModel: 'gemini-2.0-flash' | 'claude-3-5-sonnet' | 'gpt-4o';
  useMockEngine: boolean;
  saveLocalAudio: boolean;
  theme: 'dark' | 'light' | 'system';
  preferredLanguage: 'es' | 'en';
}
