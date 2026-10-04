// Read-only probes. Never prints credentials, account details or provider error bodies.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
import { readEnv } from './env.mjs';
const client = { ...readEnv('.env.local'), ...process.env };
const server = { ...readEnv('supabase/.env.local'), ...process.env };
const report = { checkedAt: new Date().toISOString(), checks: [] };
async function probe(name, url, options, inspect) {
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
    const data = await response.json().catch(() => null);
    report.checks.push({ name, status: response.status, ...inspect(response, data) });
  } catch {
    report.checks.push({ name, state: 'unreachable' });
  }
}
const origin = client.VITE_SUPABASE_URL;
if (origin) {
  await probe(
    'Supabase Auth',
    `${origin}/auth/v1/health`,
    { headers: { apikey: client.VITE_SUPABASE_PUBLISHABLE_KEY || '' } },
    (r) => ({ state: r.ok ? 'reachable' : 'failed' }),
  );
  await probe('Glu readiness', `${origin}/functions/v1/health`, {}, (r, d) => ({
    state: d?.state || 'not_deployed',
    database: d?.database ?? false,
    services: d?.services ?? null,
  }));
  for (const name of ['billing', 'paid-ai', 'transcribe', 'operations-admin']) {
    await probe(
      `${name}: anonymous access`,
      `${origin}/functions/v1/${name}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      (r) => ({ state: r.status === 401 ? 'rejected' : 'review_required' }),
    );
  }
  await probe(
    'Stripe webhook: unsigned delivery',
    `${origin}/functions/v1/stripe-webhook`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    (r, d) => ({
      state: r.status === 400 && d?.error === 'Firma ausente.' ? 'rejected' : 'review_required',
    }),
  );
  if (
    server.STRIPE_SECRET_KEY?.startsWith('sk_test_') &&
    /^whsec_/.test(server.STRIPE_WEBHOOK_SECRET || '')
  ) {
    // An unsupported test event validates signing without creating a customer, payment or ledger entry.
    const body = JSON.stringify({
      id: `evt_glu_probe_${randomUUID()}`,
      object: 'event',
      type: 'glu.readiness',
      data: { object: {} },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', server.STRIPE_WEBHOOK_SECRET)
      .update(`${timestamp}.${body}`)
      .digest('hex');
    await probe(
      'Stripe webhook: signed test probe',
      `${origin}/functions/v1/stripe-webhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': `t=${timestamp},v1=${signature}`,
        },
        body,
      },
      (r, d) => ({ state: r.ok && d?.received === true ? 'verified' : 'failed' }),
    );
  }
}
if (/^sk_(test|live)_/.test(server.STRIPE_SECRET_KEY || '')) {
  await probe(
    'Stripe account',
    'https://api.stripe.com/v1/account',
    { headers: { Authorization: `Bearer ${server.STRIPE_SECRET_KEY}` } },
    (r, d) => ({
      state: r.ok ? 'reachable' : 'failed',
      mode: server.STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test',
      chargesEnabled: d?.charges_enabled === true,
      payoutsEnabled: d?.payouts_enabled === true,
    }),
  );
  const stripeHeaders = { Authorization: `Bearer ${server.STRIPE_SECRET_KEY}` };
  for (const [plan, amount] of [
    ['PRO', 1500],
    ['PLUS', 2500],
  ]) {
    const price = server[`STRIPE_PRICE_${plan}`];
    if (!/^price_/.test(price || '')) {
      report.checks.push({ name: `Stripe ${plan}`, state: 'not_configured' });
      continue;
    }
    await probe(
      `Stripe ${plan}`,
      `https://api.stripe.com/v1/prices/${encodeURIComponent(price)}`,
      { headers: stripeHeaders },
      (r, d) => ({
        state:
          r.ok &&
          d?.active &&
          d.unit_amount === amount &&
          d.currency === 'usd' &&
          d.recurring?.interval === 'month' &&
          d.recurring?.interval_count === 1
            ? 'verified'
            : 'failed',
      }),
    );
  }
  if (/^bpc_/.test(server.STRIPE_PORTAL_CONFIGURATION_ID || '')) {
    await probe(
      'Stripe portal',
      `https://api.stripe.com/v1/billing_portal/configurations/${encodeURIComponent(server.STRIPE_PORTAL_CONFIGURATION_ID)}`,
      { headers: stripeHeaders },
      (r, d) => ({
        state:
          r.ok &&
          d?.active &&
          d.features?.subscription_cancel?.enabled &&
          d.features?.subscription_cancel?.mode === 'at_period_end' &&
          d.features?.payment_method_update?.enabled
            ? 'verified'
            : 'failed',
      }),
    );
  }
} else report.checks.push({ name: 'Stripe account', state: 'not_configured' });
if (server.GEMINI_API_KEY) {
  await probe(
    'Gemini models',
    'https://generativelanguage.googleapis.com/v1beta/models',
    { headers: { 'x-goog-api-key': server.GEMINI_API_KEY } },
    (r) => ({ state: r.ok ? 'reachable' : 'failed' }),
  );
} else report.checks.push({ name: 'Gemini models', state: 'not_configured' });
report.checks.push({
  name: 'Deepgram',
  state: server.DEEPGRAM_API_KEY ? 'credential_present_not_verified' : 'not_configured',
});
mkdirSync('release', { recursive: true });
writeFileSync('release/backend-readiness.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (
  report.checks.some((c) =>
    [
      'failed',
      'unreachable',
      'review_required',
      'not_deployed',
      'setup_required',
      'not_configured',
    ].includes(c.state),
  )
)
  process.exitCode = 1;
