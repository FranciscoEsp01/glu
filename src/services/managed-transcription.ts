import { auth, supabaseUrl } from './auth';
import { parseTranscript } from './aiService';
import type { TranscriptSegment } from '../types/meeting';

export async function managedTranscription(
  blob: Blob,
  language: 'es' | 'en',
): Promise<TranscriptSegment[]> {
  if (!auth || !supabaseUrl) throw new Error('Inicia sesión para transcribir.');
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
  const transcript: TranscriptSegment[] = [];
  for (let offset = 0; offset < samples.length; offset += sampleRate * 300) {
    const part = samples.subarray(offset, Math.min(samples.length, offset + sampleRate * 300));
    const bytes = new Uint8Array(part.length * 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < part.length; i++)
      view.setInt16(i * 2, Math.max(-32768, Math.min(32767, Math.round(part[i] * 32767))), true);
    const { data, error } = await auth.getSession();
    if (error || !data.session) throw new Error('Tu sesión finalizó. Vuelve a iniciar sesión.');
    const response = await fetch(`${supabaseUrl}/functions/v1/transcribe?language=${language}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/octet-stream',
        'x-request-id': crypto.randomUUID(),
      },
      body: bytes,
      signal: AbortSignal.timeout(110000),
    }).catch(() => {
      throw new Error('No pudimos conectar con la transcripción de Glu. El audio se conserva.');
    });
    window.dispatchEvent(new Event('glu-billing-refresh'));
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 402 || response.status === 429)
        window.dispatchEvent(new Event('glu-billing-required'));
      throw new Error(
        result?.error || 'No pudimos conectar con la transcripción de Glu. El audio se conserva.',
      );
    }
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
  }
  if (!transcript.length) throw new Error('No se detectó voz. El audio se conserva.');
  return transcript;
}
