import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import type { Runtime } from './billing-core.ts';
function required(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}
export function runtime(): Runtime {
  const returnUrl = required('BILLING_RETURN_URL');
  const url = new URL(returnUrl);
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  )
    throw new Error('Invalid BILLING_RETURN_URL');
  const proPrice = required('STRIPE_PRICE_PRO');
  const plusPrice = required('STRIPE_PRICE_PLUS');
  if (proPrice === plusPrice) throw new Error('Plans must have different Stripe price IDs');
  return {
    stripe: new Stripe(required('STRIPE_SECRET_KEY'), {
      httpClient: Stripe.createFetchHttpClient(),
      maxNetworkRetries: 1,
      timeout: 15000,
    }),
    db: createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    config: {
      proPrice,
      plusPrice,
      returnUrl,
      portalConfiguration: required('STRIPE_PORTAL_CONFIGURATION_ID'),
      webhookSecret: required('STRIPE_WEBHOOK_SECRET'),
      origins: required('BILLING_ALLOWED_ORIGINS')
        .split(',')
        .map((value) => value.trim()),
      geminiKey: Deno.env.get('GEMINI_API_KEY') || '',
      geminiModel: Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash',
    },
    fetch,
  };
}
