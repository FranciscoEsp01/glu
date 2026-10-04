import {
  authorizeFeature,
  cors,
  HttpError,
  readBytes,
  requireUser,
  responseError,
  type Runtime,
} from './billing-core.ts';
import { reserve, finish, requestId } from './consumption.ts';
export function transcriptionHandler(r: Runtime) {
  return async (req: Request) => {
    let headers: HeadersInit = {};
    try {
      headers = cors(req, r);
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido.');
      const user = await requireUser(req, r);
      const language = new URL(req.url).searchParams.get('language') || 'es';
      if (!['es', 'en'].includes(language)) throw new HttpError(400, 'Idioma no permitido.');
      if (req.headers.get('content-type') !== 'application/octet-stream')
        throw new HttpError(415, 'Envía audio PCM de 16 bits, mono, a 16 kHz.');
      if (!r.config.deepgramKey)
        throw new HttpError(503, 'La transcripción de Glu aún no está configurada.');
      const audio = await readBytes(req, 9_600_000);
      if (!audio.length || audio.length % 2 !== 0) throw new HttpError(400, 'Audio PCM inválido.');
      // Raw fixed-format PCM has a byte-exact duration; no client-reported duration is trusted.
      const seconds = Math.ceil(audio.length / 32000);
      const plan = await authorizeFeature(r, user.id, 'transcription');
      const id = requestId(req.headers.get('x-request-id'));
      await reserve(r, user.id, id, 'transcription', plan, 0, seconds);
      let providerStatus: number | undefined;
      let settled = false;
      try {
        const response = await r.fetch(
          `https://api.deepgram.com/v1/listen?model=nova-3&encoding=linear16&sample_rate=16000&channels=1&smart_format=true&diarize=true&utterances=true&language=${language}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Token ${r.config.deepgramKey}`,
              'Content-Type': 'application/octet-stream',
            },
            body: audio,
            signal: AbortSignal.timeout(90000),
          },
        );
        providerStatus = response.status;
        if (!response.ok)
          throw new HttpError(
            502,
            'No pudimos transcribir. El audio local se conserva para reintentar.',
          );
        const data = await response.json();
        settled = true;
        await finish(r, user.id, id, true, undefined, providerStatus);
        return Response.json(data, { headers });
      } catch (error) {
        if (!settled) await finish(r, user.id, id, false, undefined, providerStatus);
        throw error;
      }
    } catch (error) {
      return responseError(error, headers);
    }
  };
}
