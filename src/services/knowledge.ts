import { Meeting, AISettings } from '../types/meeting';
import { billingRequest } from './billing';
export interface Evidence {
  id: string;
  meetingId: string;
  title: string;
  date: string;
  text: string;
  score: number;
}
export interface Answer {
  answer: string;
  sources: { id: string; quote: string }[];
}
const stopwords = new Set(
  'que quien cual cuando donde como para por con del las los una uno unos unas sus tus mis nos han fue hay son era ser esta este esto esto sobre entre desde hasta the and what when where which how was were have about'.split(
    ' ',
  ),
);
const words = (text: string) =>
  text
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[a-z0-9]+/g)
    ?.filter((w) => w.length > 2 && !stopwords.has(w)) || [];
export function retrieveEvidence(meetings: Meeting[], question: string): Evidence[] {
  const terms = [...new Set(words(question))];
  if (!terms.length) return [];
  const evidence: Evidence[] = [];
  for (const meeting of meetings) {
    const text = [
      ...meeting.executiveSummary,
      ...meeting.keyDecisions.map((d) => d.decision),
      ...meeting.actionItems.map((a) => `${a.text} ${a.assignee || ''} ${a.dueDate || ''}`),
      meeting.manualNotes.replace(/<[^>]+>/g, ' '),
      ...meeting.rawTranscript.map((t) => `${t.speaker}: ${t.text}`),
    ].join('\n');
    for (let start = 0, index = 0; start < text.length; start += 1500, index++) {
      const chunk = text.slice(start, start + 2000);
      const haystack = words(`${meeting.title} ${chunk}`);
      const tokens = new Set(haystack);
      const matched = terms.filter((t) => tokens.has(t));
      if (!matched.length) continue;
      const score =
        matched.length / terms.length +
        matched.reduce((n, t) => n + Math.min(4, haystack.filter((w) => w === t).length) * 0.05, 0);
      evidence.push({
        id: `${meeting.id}:${index}`,
        meetingId: meeting.id,
        title: meeting.title,
        date: meeting.date,
        text: chunk,
        score,
      });
    }
  }
  return evidence.sort((a, b) => b.score - a.score || b.date.localeCompare(a.date)).slice(0, 8);
}
export function validateAnswer(value: unknown, evidence: Evidence[]): Answer {
  const v = value as Partial<Answer> | null;
  if (!v || typeof v.answer !== 'string' || !Array.isArray(v.sources))
    throw new Error('La respuesta no tiene el formato esperado. Reintenta la pregunta.');
  const sources = v.sources.filter(
    (s) =>
      s &&
      typeof s.id === 'string' &&
      typeof s.quote === 'string' &&
      s.quote.trim().length >= 3 &&
      evidence.some((e) => e.id === s.id && e.text.includes(s.quote)),
  );
  if (!sources.length || sources.length !== v.sources.length)
    return {
      answer:
        'No encontré evidencia verificable para responder. Prueba con el nombre del cliente o un tema más concreto.',
      sources: [],
    };
  return { answer: v.answer, sources };
}
export async function askMeetings(
  question: string,
  evidence: Evidence[],
  settings: AISettings,
): Promise<Answer> {
  if (!evidence.length)
    return {
      answer:
        'No encontré fragmentos relacionados. Prueba con un nombre, cliente o tema que aparezca en tus reuniones.',
      sources: [],
    };
  const data: any = await billingRequest('paid-ai', {
    feature: 'knowledge',
    question,
    evidence: evidence.map(({ score: _score, ...e }) => e),
    language: settings.preferredLanguage,
  });
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('');
  if (!text) throw new Error('Gemini no devolvió una respuesta.');
  return validateAnswer(JSON.parse(text), evidence);
}
