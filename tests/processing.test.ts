import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ProcessingError,
  retryJob,
  recoverJob,
  type ProcessingJob,
} from '../src/services/processing-state';
const job = (): ProcessingJob => ({
  id: crypto.randomUUID(),
  requestId: crypto.randomUUID(),
  state: 'running',
  stage: 'transcription',
  attempts: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  nextChunk: 1,
  totalChunks: 2,
  partialTranscript: [{ id: '0', speaker: 'A', text: 'Guardado', timestamp: 0 }],
  payload: {
    title: 'Reunión',
    templateType: 'general',
    transcript: [],
    manualNotes: '',
    rapidNotes: [],
    durationMinutes: 1,
  },
  settings: { preferredLanguage: 'es', saveLocalAudio: true },
});
test('Restart recovers the stable operation ID and completed audio checkpoints', () => {
  const previous = job();
  const recovered = recoverJob(JSON.parse(JSON.stringify(previous)))!;
  assert.equal(recovered.state, 'queued');
  assert.equal(recovered.requestId, previous.requestId);
  assert.deepEqual(recovered.partialTranscript, previous.partialTranscript);
  assert.equal(recovered.nextChunk, 1);
});
test('Lost network responses retry the same ID with backoff and stop after three attempts', () => {
  const initial = job();
  let current = initial;
  for (let i = 1; i <= 3; i++) {
    current = retryJob(current, new ProcessingError('Sin conexión', 'connection', true), 1000);
    assert.equal(current.requestId, initial.requestId);
    assert.equal(current.attempts, i);
    assert.equal(current.state, i < 3 ? 'retry_wait' : 'blocked');
    if (i < 3) assert.ok(Date.parse(current.nextAttemptAt!) > 1000);
  }
});
test('Only a confirmed transient provider failure rotates IDs; quotas and ambiguous outcomes stop', () => {
  const previous = job();
  const next = retryJob(
    previous,
    new ProcessingError('HTTP 500', 'provider_failed', true, true),
    1000,
  );
  assert.notEqual(next.requestId, previous.requestId);
  assert.equal(next.state, 'retry_wait');
  assert.equal(retryJob(previous, new ProcessingError('Límite', 'quota')).state, 'failed');
  assert.equal(
    retryJob(previous, new ProcessingError('No confirmado', 'operation_unknown')).state,
    'blocked',
  );
  assert.equal(
    retryJob(previous, new ProcessingError('Caducado', 'result_expired')).state,
    'blocked',
  );
});

test('Polling a still-running server operation is bounded and does not create provider attempts', () => {
  const previous = { ...job(), operationStartedAt: new Date(1000).toISOString() };
  const polling = retryJob(
    previous,
    new ProcessingError('En curso', 'operation_running', true),
    10000,
  );
  assert.equal(polling.attempts, 0);
  assert.equal(polling.requestId, previous.requestId);
  assert.equal(polling.state, 'retry_wait');
  const expired = retryJob(
    polling,
    new ProcessingError('En curso', 'operation_running', true),
    400000,
  );
  assert.equal(expired.state, 'blocked');
  assert.equal(expired.requestId, previous.requestId);
});
