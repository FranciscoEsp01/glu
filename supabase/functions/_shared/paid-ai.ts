import {
  authorizeFeature,
  cors,
  HttpError,
  readJson,
  requireUser,
  responseError,
  type Runtime,
} from './billing-core.ts';
import { buildPrompt } from './ai-prompts.ts';
export function paidAIHandler(r: Runtime) {
  return async (req: Request) => {
    let headers: HeadersInit = {};
    try {
      headers = cors(req, r);
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido.');
      const user = await requireUser(req, r);
      const body = await readJson(req, 256_000);
      const prompt = buildPrompt(body);
      if (body.feature !== 'summary' && body.feature !== 'knowledge')
        throw new HttpError(400, 'Función inválida.');
      if (!r.config.geminiKey)
        throw new HttpError(503, 'El procesamiento de IA aún no está disponible.');
      // This is the enforcement boundary. Editing client state cannot bypass this check.
      await authorizeFeature(r, user.id, body.feature, true);
      const response = await r.fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(r.config.geminiModel)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': r.config.geminiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
              maxOutputTokens: 8192,
            },
          }),
          signal: AbortSignal.timeout(90000),
        },
      );
      if (!response.ok)
        throw new HttpError(
          502,
          'No se pudo generar la respuesta. Tus datos locales se conservan.',
        );
      return Response.json(await response.json(), { headers });
    } catch (error) {
      return responseError(error, headers);
    }
  };
}
