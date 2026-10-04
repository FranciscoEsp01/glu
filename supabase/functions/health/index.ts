import { healthHandler } from '../_shared/health.ts';
import { operationsRuntime } from '../_shared/operations-runtime.ts';
const r = operationsRuntime();
const present = (name: string) => {
  const value = Deno.env.get(name) || '';
  return !!value && !/replace|placeholder|example/i.test(value);
};
const billing = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_PLUS',
  'STRIPE_PORTAL_CONFIGURATION_ID',
  'BILLING_RETURN_URL',
  'BILLING_ALLOWED_ORIGINS',
].every(present);
Deno.serve(
  healthHandler({
    checkDatabase: async () => {
      const result = await r.db.rpc('backend_health');
      return !result.error && result.data === true;
    },
    configured: {
      billing,
      summary: billing && present('GEMINI_API_KEY'),
      transcription: billing && present('DEEPGRAM_API_KEY'),
    },
  }),
);
