import { Meeting, TemplateType } from '../types/meeting';
const list = (value: unknown): any[] => (Array.isArray(value) ? value : []);
const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const strings = (value: unknown) => list(value).filter((v) => typeof v === 'string');
export function backupHistory(meetings: Meeting[]) {
  return JSON.stringify(
    {
      format: 'glu-history',
      version: 1,
      exportedAt: new Date().toISOString(),
      includesAudio: false,
      meetings: meetings.map(({ audioUrl: _url, ...m }) => ({ ...m, hasAudio: false })),
    },
    null,
    2,
  );
}
export function parseBackup(content: string): Meeting[] {
  const backup = JSON.parse(content);
  if (
    backup?.format !== 'glu-history' ||
    backup.version !== 1 ||
    !Array.isArray(backup.meetings) ||
    backup.meetings.length > 10000
  )
    throw new Error('No es una copia de historial de Glu compatible.');
  const ids = new Set<string>();
  return backup.meetings.map((m: any) => {
    if (
      !m ||
      typeof m.id !== 'string' ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(m.id) ||
      ids.has(m.id) ||
      typeof m.title !== 'string' ||
      !Number.isFinite(Date.parse(m.date))
    )
      throw new Error(
        'La copia contiene reuniones inválidas o duplicadas. No se modificó tu historial.',
      );
    ids.add(m.id);
    return {
      id: m.id,
      title: m.title,
      date: new Date(m.date).toISOString(),
      durationMinutes: Number.isFinite(m.durationMinutes) ? Math.max(0, m.durationMinutes) : 0,
      templateType: (['general', 'sales', 'one_on_one', 'ux_research', 'standup'].includes(
        m.templateType,
      )
        ? m.templateType
        : 'general') as TemplateType,
      participants: list(m.participants)
        .filter((p) => p && typeof p.name === 'string')
        .map((p, i) => ({ id: `participant-${i}`, name: p.name })),
      executiveSummary: strings(m.executiveSummary),
      actionItems: list(m.actionItems)
        .filter((a) => a && typeof a.text === 'string')
        .map((a, i) => ({
          id: `action-${i}`,
          text: a.text,
          completed: a.completed === true,
          assignee: text(a.assignee) || undefined,
          dueDate: text(a.dueDate) || undefined,
        })),
      keyDecisions: list(m.keyDecisions)
        .filter((d) => d && typeof d.decision === 'string')
        .map((d, i) => ({
          id: `decision-${i}`,
          decision: d.decision,
          rationale: text(d.rationale) || undefined,
        })),
      unresolvedQuestions: strings(m.unresolvedQuestions),
      rawTranscript: list(m.rawTranscript)
        .filter((t) => t && typeof t.text === 'string')
        .map((t, i) => ({
          id: `segment-${i}`,
          text: t.text,
          speaker: text(t.speaker, 'Hablante'),
          timestamp: Number.isFinite(t.timestamp) ? Math.max(0, t.timestamp) : 0,
        })),
      manualNotes: text(m.manualNotes),
      originalNotes: text(m.originalNotes),
      hasAudio: false,
      tags: strings(m.tags),
      category: 'archived' as const,
      isStarred: m.isStarred === true,
      status: m.executiveSummary?.length ? ('ready' as const) : ('pending' as const),
    };
  });
}
export function mergeHistory(existing: Meeting[], imported: Meeting[]) {
  const ids = new Set(existing.map((m) => m.id));
  return [...existing, ...imported.filter((m) => !ids.has(m.id))].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}
