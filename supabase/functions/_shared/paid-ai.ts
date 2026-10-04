import {
  authorizeFeature,
  cors,
  HttpError,
  readJson,
  requireUser,
  responseError,
  type Runtime,
} from './billing-core.ts';
import { reserve, finish, usageMetadata, requestId } from './consumption.ts';
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
      const plan = await authorizeFeature(r, user.id, body.feature);
      const id = requestId(req.headers.get('x-request-id'));
      await reserve(
        r,
        user.id,
        id,
        body.feature,
        plan,
        new TextEncoder().encode(prompt).length + 8192,
      );
      let providerStatus: number | undefined;
      let settled = false;
      try {
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
        providerStatus = response.status;
        if (!response.ok)
          throw new HttpError(
            502,
            'No se pudo generar la respuesta. Tus datos locales se conservan.',
          );
        const data = await response.json();
        settled = true;
        await finish(r, user.id, id, true, usageMetadata(data), providerStatus);
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
