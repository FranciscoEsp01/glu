import { processingRequest } from './processing-request';
import { parseTranscript } from './aiService';
import type { TranscriptSegment } from '../types/meeting';

export async function managedTranscription(
  blob: Blob,
  language: 'es' | 'en',
  checkpoint?: {
    nextChunk: number;
    partial: TranscriptSegment[];
    requestId: () => Promise<string>;
    save: (nextChunk: number, totalChunks: number, partial: TranscriptSegment[]) => Promise<void>;
  },
): Promise<TranscriptSegment[]> {
  if (blob.size > 100_000_000)
    throw new Error('El audio supera 100 MB. Divide la grabación antes de transcribir.');
  const context = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(await blob.arrayBuffer());
  } finally {
    await context.close();
  }
  if (decoded.duration > 7200)
    throw new Error('La grabación supera dos horas. Divide el audio antes de transcribir.');
  const sampleRate = 16000;
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate), sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0);
  const transcript: TranscriptSegment[] = [...(checkpoint?.partial || [])];
  const totalChunks = Math.ceil(samples.length / (sampleRate * 300));
  for (
    let offset = (checkpoint?.nextChunk || 0) * sampleRate * 300;
    offset < samples.length;
    offset += sampleRate * 300
  ) {
    const part = samples.subarray(offset, Math.min(samples.length, offset + sampleRate * 300));
    const bytes = new Uint8Array(part.length * 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < part.length; i++)
      view.setInt16(i * 2, Math.max(-32768, Math.min(32767, Math.round(part[i] * 32767))), true);
    const result = await processingRequest(
      'transcribe',
      bytes,
      (await checkpoint?.requestId()) || crypto.randomUUID(),
      language,
    );
    const timeOffset = offset / sampleRate;
    transcript.push(
      ...parseTranscript(result).map((s, i) => ({
        ...s,
        id: `${offset}-${i}`,
        timestamp: s.timestamp + timeOffset,
        speaker:
          samples.length > sampleRate * 300
            ? `Bloque ${Math.floor(offset / (sampleRate * 300)) + 1} · ${s.speaker}`
            : s.speaker,
      })),
    );
    await checkpoint?.save(Math.floor(offset / (sampleRate * 300)) + 1, totalChunks, [
      ...transcript,
    ]);
  }
  if (!transcript.length) throw new Error('No se detectó voz. El audio se conserva.');
  return transcript;
}
