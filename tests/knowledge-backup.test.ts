import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retrieveEvidence, validateAnswer } from '../src/services/knowledge';
import { backupHistory, parseBackup, mergeHistory } from '../src/services/backup';
import { notionBlocks, notionPageId, shareContent } from '../src/services/integrations';
import { Meeting } from '../src/types/meeting';
const meeting: Meeting = {
  id: 'test-1',
  title: 'Acme presupuesto',
  date: '2026-09-30T12:00:00Z',
  durationMinutes: 2,
  templateType: 'general',
  participants: [],
  executiveSummary: ['Acme aprobó 5000 dólares.'],
  actionItems: [],
  keyDecisions: [],
  rawTranscript: [
    { id: 't', speaker: 'Ana', text: 'Enviaremos la propuesta el viernes.', timestamp: 1 },
  ],
  manualNotes: '<p>Preparar la propuesta.</p>',
  tags: [],
  category: 'today',
  hasAudio: true,
  audioUrl: 'blob:not-portable',
};
test('Retrieval finds accented Spanish evidence and limits context sent to the model', () => {
  const evidence = retrieveEvidence([meeting], '¿Qué presupuesto aprobó Acme?');
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].meetingId, 'test-1');
  assert.equal(retrieveEvidence([meeting], 'astronomía').length, 0);
  assert.ok(
    retrieveEvidence([{ ...meeting, manualNotes: 'Acme presupuesto '.repeat(10000) }], 'Acme')
      .length <= 8,
  );
});
test('Answers cannot attach fabricated quotes or unknown source IDs', () => {
  const evidence = retrieveEvidence([meeting], 'Acme');
  assert.equal(
    validateAnswer(
      { answer: 'Inventado', sources: [{ id: evidence[0].id, quote: 'Se aprobó un millón.' }] },
      evidence,
    ).sources.length,
    0,
  );
  assert.equal(
    validateAnswer(
      { answer: '5000', sources: [{ id: evidence[0].id, quote: 'Acme aprobó 5000 dólares.' }] },
      evidence,
    ).sources.length,
    1,
  );
  assert.equal(
    validateAnswer(
      {
        answer: 'Mixto',
        sources: [
          { id: evidence[0].id, quote: 'Acme aprobó 5000 dólares.' },
          { id: 'inventado', quote: 'Nada' },
        ],
      },
      evidence,
    ).sources.length,
    0,
  );
});
test('Backup round trip excludes media and merges without overwriting existing edits', () => {
  const content = backupHistory([meeting]);
  assert.ok(!content.includes('blob:not-portable'));
  const restored = parseBackup(content);
  assert.equal(restored[0].hasAudio, false);
  assert.equal(restored[0].rawTranscript[0].text, meeting.rawTranscript[0].text);
  const existing = { ...meeting, title: 'Editado' };
  assert.equal(mergeHistory([existing], restored)[0].title, 'Editado');
  assert.equal(mergeHistory([existing], restored).length, 1);
});
test('Restore refuses invalid records and duplicate IDs without partial import', () => {
  assert.throws(() => parseBackup('{}'));
  assert.throws(() =>
    parseBackup(
      JSON.stringify({
        format: 'glu-history',
        version: 1,
        meetings: [{ ...meeting, id: '../escape' }],
      }),
    ),
  );
  assert.throws(() => parseBackup(backupHistory([meeting, meeting])));
});
test('Notion chunking respects Unicode boundaries and title page IDs; sharing omits full transcript', () => {
  const blocks = notionBlocks('🙂'.repeat(3000));
  assert.equal(
    blocks.map((b) => b.paragraph.rich_text[0].text.content).join(''),
    '🙂'.repeat(3000),
  );
  assert.ok(blocks.every((b) => b.paragraph.rich_text[0].text.content.length <= 2000));
  assert.equal(
    notionPageId('https://www.notion.so/Reuniones-0123456789abcdef0123456789abcdef?source=copy'),
    '0123456789abcdef0123456789abcdef',
  );
  assert.throws(() => notionPageId('not-a-page'));
  assert.ok(!shareContent(meeting).includes('Enviaremos la propuesta el viernes.'));
  assert.ok(shareContent(meeting).includes('5000'));
});
