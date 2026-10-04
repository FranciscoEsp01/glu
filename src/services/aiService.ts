import {
  TemplateType,
  TranscriptSegment,
  ActionItem,
  KeyDecision,
  AISettings,
} from '../types/meeting';
import { managedTranscription } from './managed-transcription';
import { billingRequest } from './billing';
import { escapeHtml } from '../lib/platform';
export interface GenerateSummaryPayload {
  title: string;
  templateType: TemplateType;
  transcript: TranscriptSegment[];
  rapidNotes: string[];
  manualNotes: string;
  durationMinutes: number;
}
export interface AISummaryResponse {
  title: string;
  executiveSummary: string[];
  actionItems: ActionItem[];
  keyDecisions: KeyDecision[];
  unresolvedQuestions: string[];
  enrichedNotes: string;
}
const strings = (v: unknown): string[] => {
  if (!Array.isArray(v) || v.some((s) => typeof s !== 'string'))
    throw new Error('La IA devolvió una estructura inválida. Puedes reintentar.');
  return v;
};
export function validateSummary(value: unknown): AISummaryResponse {
  if (!value || typeof value !== 'object') throw new Error('Respuesta de IA vacía.');
  const v = value as Record<string, unknown>;
  if (
    typeof v.title !== 'string' ||
    typeof v.enrichedNotes !== 'string' ||
    !Array.isArray(v.actionItems) ||
    !Array.isArray(v.keyDecisions)
  )
    throw new Error('Respuesta de IA incompleta.');
  return {
    title: v.title,
    executiveSummary: strings(v.executiveSummary),
    unresolvedQuestions: strings(v.unresolvedQuestions),
    enrichedNotes: v.enrichedNotes
      .split('\n')
      .filter(Boolean)
      .map((s) => `<p>${escapeHtml(s)}</p>`)
      .join(''),
    actionItems: v.actionItems.map((a, i) => {
      if (!a || typeof a.text !== 'string') throw new Error('Tarea inválida en la respuesta.');
      return {
        id: `action-${i}`,
        text: a.text,
        completed: false,
        assignee: typeof a.assignee === 'string' ? a.assignee : undefined,
        dueDate:
          typeof a.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate)
            ? a.dueDate
            : undefined,
      };
    }),
    keyDecisions: v.keyDecisions.map((d, i) => {
      if (!d || typeof d.decision !== 'string')
        throw new Error('Decisión inválida en la respuesta.');
      return {
        id: `decision-${i}`,
        decision: d.decision,
        rationale: typeof d.rationale === 'string' ? d.rationale : undefined,
      };
    }),
  };
}
export function parseTranscript(data: any): TranscriptSegment[] {
  const utterances = data.results?.utterances;
  if (Array.isArray(utterances) && utterances.length)
    return utterances.map((u: any, i: number) => ({
      id: `segment-${i}`,
      speaker: `Hablante ${(u.speaker ?? 0) + 1}`,
      timestamp: Number(u.start) || 0,
      duration: Math.max(0, u.end - u.start),
      text: String(u.transcript || ''),
    }));
  const text = data.results?.channels?.[0]?.alternatives?.[0]?.transcript;
  return typeof text === 'string' && text.trim()
    ? [{ id: 'segment-0', speaker: 'Hablante', timestamp: 0, text }]
    : [];
}
export class AIService {
  static async transcribe(
    id: string,
    blob: Blob | undefined,
    settings: AISettings,
  ): Promise<TranscriptSegment[]> {
    if (!blob) throw new Error('El audio no está disponible. Puedes pegar una transcripción.');
    void id;
    return managedTranscription(blob, settings.preferredLanguage);
  }
  static async processMeeting(
    payload: GenerateSummaryPayload,
    settings: AISettings,
  ): Promise<AISummaryResponse> {
    if (!payload.transcript.length && !payload.manualNotes.trim())
      throw new Error('Añade una transcripción o notas antes de generar el resumen.');
    const data: any = await billingRequest('paid-ai', {
      feature: 'summary',
      payload,
      language: settings.preferredLanguage,
    });
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('');
    if (!text) throw new Error('Gemini no devolvió un resumen. Puedes reintentar.');
    return validateSummary(JSON.parse(text));
  }
}
