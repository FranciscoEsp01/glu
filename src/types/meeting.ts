import type { ProcessingJob } from '../services/processing-state';
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
  speaker: string;
  text: string;
  timestamp: number;
  duration?: number;
}
export interface Meeting {
  id: string;
  title: string;
  date: string;
  durationMinutes: number;
  templateType: TemplateType;
  participants: Participant[];
  executiveSummary: string[];
  actionItems: ActionItem[];
  keyDecisions: KeyDecision[];
  unresolvedQuestions?: string[];
  rawTranscript: TranscriptSegment[];
  manualNotes: string;
  originalNotes?: string;
  audioUrl?: string;
  audioDurationSec?: number;
  hasAudio?: boolean;
  tags: string[];
  category: 'today' | 'this_week' | 'sales' | 'one_on_one' | 'engineering' | 'archived';
  isStarred?: boolean;
  status?: 'recording' | 'pending' | 'processing' | 'ready' | 'error';
  error?: string;
  processingJob?: ProcessingJob;
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
export interface AISettings {
  geminiApiKey: string;
  deepgramApiKey: string;
  slackToken?: string;
  slackChannel?: string;
  notionToken?: string;
  notionParentPage?: string;
  selectedModel: string;
  saveLocalAudio: boolean;
  theme: 'dark' | 'light' | 'system';
  preferredLanguage: 'es' | 'en';
  captureSource: 'microphone' | 'dual';
}
