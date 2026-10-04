// Creates the requested catalog only in Stripe test mode; never creates a payment.
import Stripe from 'stripe';
import { readFileSync, writeFileSync } from 'node:fs';
import { readEnv } from './env.mjs';
const path = 'supabase/.env.local';
const env = readEnv(path);
if (!env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))
  throw new Error('Se requiere una clave de pruebas. Este script nunca modifica Stripe live.');
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 1, timeout: 20000 });
const configured = {};
for (const [plan, amount] of [
  ['pro', 1500],
  ['plus', 2500],
]) {
  const products = await stripe.products.list({ active: true, limit: 100 });
  let product = products.data.find((p) => p.metadata.glu_plan === plan);
  if (!product)
    product = await stripe.products.create(
      { name: `Glu ${plan === 'pro' ? 'Pro' : 'Plus'}`, metadata: { glu_plan: plan } },
      { idempotencyKey: `glu-product-${plan}-v1` },
    );
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  let price = prices.data.find(
    (p) =>
      p.unit_amount === amount &&
      p.currency === 'usd' &&
      p.recurring?.interval === 'month' &&
      p.recurring?.interval_count === 1,
  );
  if (!price)
    price = await stripe.prices.create(
      {
        product: product.id,
        unit_amount: amount,
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { glu_plan: plan },
      },
      { idempotencyKey: `glu-price-${plan}-${amount}-usd-month-v1` },
    );
  configured[`STRIPE_PRICE_${plan.toUpperCase()}`] = price.id;
}
const configurations = await stripe.billingPortal.configurations.list({ limit: 100 });
let portal = configurations.data.find((p) => p.active && p.metadata.glu_portal === 'v1');
if (!portal)
  portal = await stripe.billingPortal.configurations.create(
    {
      metadata: { glu_portal: 'v1' },
      features: {
        customer_update: { enabled: false },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
        subscription_update: { enabled: false },
      },
    },
    { idempotencyKey: 'glu-portal-v1' },
  );
configured.STRIPE_PORTAL_CONFIGURATION_ID = portal.id;
const frontend = readEnv('.env.local');
const url = `${frontend.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`;
const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
const existing = endpoints.data.find((e) => e.url === url && e.status === 'enabled');
if (!existing) {
  const endpoint = await stripe.webhookEndpoints.create(
    {
      url,
      metadata: { app: 'glu' },
      enabled_events: [
        'checkout.session.completed',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'customer.subscription.paused',
        'customer.subscription.resumed',
        'invoice.paid',
        'invoice.payment_failed',
        'invoice.payment_action_required',
      ],
    },
    { idempotencyKey: 'glu-webhook-v1' },
  );
  if (endpoint.secret) configured.STRIPE_WEBHOOK_SECRET = endpoint.secret;
}
let source = readFileSync(path, 'utf8');
for (const [name, value] of Object.entries(configured)) {
  const regex = new RegExp(`^${name}=.*$`, 'm');
  source = regex.test(source)
    ? source.replace(regex, `${name}=${value}`)
    : source + `\n${name}=${value}\n`;
}
writeFileSync(path, source, { mode: 0o600 });
console.log(
  'Catálogo de pruebas configurado: Pro 15 USD/mes, Plus 25 USD/mes, portal y webhook. Identificadores y secretos guardados solo en supabase/.env.local. No se han activado cobros reales.',
);
if (existing && !/^whsec_/.test(env.STRIPE_WEBHOOK_SECRET || ''))
  console.log(
    'El webhook ya existía: recupera su secreto en Stripe; no se puede leer mediante la API.',
  );
