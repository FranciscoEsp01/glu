export interface HealthRuntime {
  checkDatabase: () => Promise<boolean>;
  configured: { billing: boolean; summary: boolean; transcription: boolean };
}
export function healthHandler(r: HealthRuntime) {
  return async (req: Request) => {
    const headers = { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'GET')
      return Response.json({ error: 'Método no permitido.' }, { status: 405, headers });
    let database = false;
    try {
      database = await r.checkDatabase();
    } catch {
      /* Do not return provider errors or credentials. */
    }
    const ready = database && Object.values(r.configured).every(Boolean);
    return Response.json(
      {
        version: '0.8.0',
        state: ready ? 'ready' : 'setup_required',
        database,
        services: r.configured,
      },
      { status: ready ? 200 : 503, headers },
    );
  };
}
