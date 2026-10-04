import {
  cors,
  HttpError,
  readJson,
  requireUser,
  responseError,
  type Runtime,
} from './billing-core.ts';
export type OperationsRuntime = {
  db: Runtime['db'];
  config: { origins: string[] };
  rates?: { input: number | null; output: number | null; audio: number | null };
};
export function operationsHandler(r: OperationsRuntime) {
  return async (req: Request) => {
    let headers: HeadersInit = {};
    try {
      headers = cors(req, r);
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido.');
      const user = await requireUser(req, r);
      const membership = await r.db
        .from('operator_accounts')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (membership.error) throw new HttpError(503, 'No pudimos comprobar el acceso operativo.');
      if (!membership.data) throw new HttpError(403, 'Esta cuenta no tiene acceso de operador.');
      const body = await readJson(req);
      if (body.action === 'access') return Response.json({ allowed: true }, { headers });
      if (body.action === 'acknowledge') {
        if (!['interrupted_operations', 'provider_failures'].includes(String(body.key)))
          throw new HttpError(400, 'Aviso inválido.');
        const result = await r.db.rpc('acknowledge_operational_alert', {
          p_operator: user.id,
          p_key: body.key,
        });
        if (result.error) throw new HttpError(503, 'No pudimos registrar la revisión.');
        return Response.json({ acknowledged: true }, { headers });
      }
      if (body.action !== 'snapshot') throw new HttpError(400, 'Acción inválida.');
      const result = await r.db.rpc('operations_snapshot', { p_operator: user.id });
      if (result.error) throw new HttpError(503, 'No pudimos consultar las operaciones.');
      const rates = r.rates;
      const accounts = (result.data?.accounts || []).map((a: any) => ({
        ...a,
        estimatedCostUSD:
          rates?.input !== null &&
          rates?.input !== undefined &&
          rates.output !== null &&
          rates.audio !== null
            ? (Number(a.measured_input) * rates.input) / 1000000 +
              (Number(a.measured_output) * rates.output) / 1000000 +
              (Number(a.audio_seconds) * rates.audio) / 60
            : null,
      }));
      return Response.json(
        { ...result.data, accounts, generatedAt: new Date().toISOString() },
        { headers },
      );
    } catch (error) {
      return responseError(error, headers);
    }
  };
}
