import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSummary, parseTranscript } from '../src/services/aiService';
import { exportMarkdown } from '../src/services/export';
const valid = {
  title: 'Entrega',
  executiveSummary: ['Entregar el viernes'],
  actionItems: [{ text: 'Enviar propuesta', assignee: null, dueDate: null }],
  keyDecisions: [],
  unresolvedQuestions: [],
  enrichedNotes: '<img src=x onerror=alert(1)>',
};
test('AI output escapes HTML and does not invent absent assignees or dates', () => {
  const result = validateSummary(valid);
  assert.equal(result.actionItems[0].assignee, undefined);
  assert.equal(result.actionItems[0].dueDate, undefined);
  assert.ok(!result.enrichedNotes.includes('<img'));
  assert.ok(result.enrichedNotes.includes('&lt;img'));
});
test('Malformed provider response cannot enter the meeting store', () => {
  assert.throws(() => validateSummary({ ...valid, executiveSummary: 'invalid' }));
  assert.throws(() => validateSummary({ ...valid, actionItems: [null] }));
  assert.throws(() => validateSummary(null));
});
test('Diarized transcription preserves timestamps and does not manufacture speech for silence', () => {
  assert.deepEqual(
    parseTranscript({ results: { channels: [{ alternatives: [{ transcript: '' }] }] } }),
    [],
  );
  assert.deepEqual(
    parseTranscript({
      results: { utterances: [{ transcript: 'Hola', start: 12, end: 14, speaker: 1 }] },
    }),
    [{ id: 'segment-0', speaker: 'Hablante 2', timestamp: 12, duration: 2, text: 'Hola' }],
  );
});
test('Markdown export includes actual tasks and transcript', () => {
  const result = exportMarkdown({
    id: '1',
    title: 'Entrega',
    date: '2026-09-30',
    durationMinutes: 1,
    templateType: 'general',
    participants: [],
    executiveSummary: ['Resumen'],
    actionItems: [{ id: 'a', text: 'Enviar', completed: true }],
    keyDecisions: [],
    rawTranscript: [{ id: 's', speaker: 'Ana', text: 'El viernes', timestamp: 65 }],
    manualNotes: '<p>Apunte &amp; detalle</p>',
    tags: [],
    category: 'today',
  });
  assert.match(result, /- \[x\] Enviar/);
  assert.match(result, /\[1:05\] Ana: El viernes/);
  assert.match(result, /Apunte & detalle/);
});
