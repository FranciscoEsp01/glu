import { createClient } from '@supabase/supabase-js';
export function operationsRuntime() {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const rate = (name: string) => {
    const value = Deno.env.get(name)?.trim();
    if (!value) return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return {
    db: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    config: {
      origins: (
        Deno.env.get('BILLING_ALLOWED_ORIGINS') ||
        'tauri://localhost,http://tauri.localhost,http://localhost:1420,http://127.0.0.1:1420'
      )
        .split(',')
        .map((x) => x.trim()),
    },
    rates: {
      input: rate('GEMINI_INPUT_USD_PER_MILLION'),
      output: rate('GEMINI_OUTPUT_USD_PER_MILLION'),
      audio: rate('DEEPGRAM_USD_PER_MINUTE'),
    },
  };
}
