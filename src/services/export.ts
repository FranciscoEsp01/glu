import { Meeting } from '../types/meeting';
export function exportMarkdown(m: Meeting) {
  return [
    `# ${m.title}`,
    new Date(m.date).toLocaleString('es-CL'),
    '\n## Resumen',
    ...m.executiveSummary.map((s) => `- ${s}`),
    '\n## Tareas',
    ...m.actionItems.map(
      (a) =>
        `- [${a.completed ? 'x' : ' '}] ${a.text}${a.assignee ? ` — ${a.assignee}` : ''}${a.dueDate ? ` (${a.dueDate})` : ''}`,
    ),
    '\n## Decisiones',
    ...m.keyDecisions.map((d) => `- ${d.decision}`),
    '\n## Notas',
    m.manualNotes
      .replace(/<\/(p|li|h[1-6])>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
    '\n## Transcripción',
    ...m.rawTranscript.map(
      (t) =>
        `[${Math.floor(t.timestamp / 60)}:${Math.floor(t.timestamp % 60)
          .toString()
          .padStart(2, '0')}] ${t.speaker}: ${t.text}`,
    ),
  ].join('\n');
}
export function downloadFile(name: string, content: string, mime = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
