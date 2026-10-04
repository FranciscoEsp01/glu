import type { GenerateSummaryPayload } from './aiService';
import type { TranscriptSegment, AISettings } from '../types/meeting';
export type JobState =
  'queued' | 'running' | 'retry_wait' | 'blocked' | 'failed' | 'succeeded' | 'canceled';
export interface ProcessingJob {
  id: string;
  state: JobState;
  stage: 'transcription' | 'summary';
  requestId: string;
  attempts: number;
  operationStartedAt?: string;
  nextAttemptAt?: string;
  createdAt: string;
  updatedAt: string;
  nextChunk: number;
  totalChunks?: number;
  partialTranscript: TranscriptSegment[];
  payload: GenerateSummaryPayload;
  settings: Pick<AISettings, 'preferredLanguage' | 'saveLocalAudio'>;
  error?: string;
  code?: string;
  newOperation?: boolean;
}
export class ProcessingError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable = false,
    public newOperation = false,
  ) {
    super(message);
  }
}
export const isJobPending = (job?: ProcessingJob) =>
  !!job && ['queued', 'running', 'retry_wait'].includes(job.state);
export function recoverJob(job?: ProcessingJob): ProcessingJob | undefined {
  if (!job) return undefined;
  return job.state === 'running'
    ? { ...job, state: 'queued', updatedAt: new Date().toISOString() }
    : job;
}
export function retryJob(job: ProcessingJob, error: unknown, now = Date.now()): ProcessingJob {
  const e =
    error instanceof ProcessingError
      ? error
      : new ProcessingError(
          error instanceof Error ? error.message : 'No pudimos procesar la reunión.',
          'invalid_result',
        );
  if (
    e.code === 'operation_running' &&
    now - Date.parse(job.operationStartedAt || job.createdAt) < 300000
  ) {
    return {
      ...job,
      state: 'retry_wait',
      nextAttemptAt: new Date(now + 5000).toISOString(),
      updatedAt: new Date(now).toISOString(),
      error: e.message,
      code: e.code,
    };
  }
  const attempts = job.attempts + 1;
  const retryable = e.retryable && attempts < 3 && e.code !== 'operation_running';
  const blocked =
    [
      'operation_unknown',
      'operation_running',
      'result_expired',
      'operation_conflict',
      'duplicate',
    ].includes(e.code) ||
    (e.retryable && !e.newOperation && !retryable);
  return {
    ...job,
    attempts,
    state: retryable ? 'retry_wait' : blocked ? 'blocked' : 'failed',
    requestId: retryable && e.newOperation ? crypto.randomUUID() : job.requestId,
    operationStartedAt:
      retryable && e.newOperation ? new Date(now).toISOString() : job.operationStartedAt,
    nextAttemptAt: retryable
      ? new Date(
          now + (e.code === 'busy' ? 60000 : [5000, 15000, 45000][attempts - 1]),
        ).toISOString()
      : undefined,
    error: e.message,
    code: e.code,
    newOperation: e.newOperation,
    updatedAt: new Date(now).toISOString(),
  };
}
export function jobLabel(job: ProcessingJob) {
  const labels: Record<JobState, string> = {
    queued: 'En cola',
    running: 'Procesando',
    retry_wait: 'Esperando reintento',
    blocked: 'Revisión necesaria',
    failed: 'No completado',
    succeeded: 'Completado',
    canceled: 'Cancelado',
  };
  const stage =
    job.stage === 'transcription'
      ? `Transcripción${job.totalChunks ? ` · ${job.nextChunk} de ${job.totalChunks} bloques guardados` : ''}`
      : 'Resumen';
  return `${labels[job.state]} · ${stage}`;
}
