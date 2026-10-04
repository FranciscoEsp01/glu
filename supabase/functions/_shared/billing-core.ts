import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PLANS,
  effectivePlan,
  hasFeature,
  blocksCheckout,
  type PaidFeature,
  type SubscriptionSnapshot,
} from './plans.ts';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export interface Runtime {
  stripe: Stripe;
  db: SupabaseClient;
  config: {
    proPrice: string;
    plusPrice: string;
    returnUrl: string;
    portalConfiguration: string;
    webhookSecret: string;
    origins: string[];
    geminiKey: string;
    geminiModel: string;
    deepgramKey?: string;
  };
  fetch: typeof fetch;
}
function checked<T extends { error: unknown }>(result: T): T {
  if (result.error)
    throw new HttpError(503, 'No pudimos guardar el estado de facturación. Reintenta.');
  return result;
}
export function cors(req: Request, runtime: Runtime) {
  const origin = req.headers.get('origin');
  if (origin && !runtime.config.origins.includes(origin))
    throw new HttpError(403, 'Origen no permitido.');
  return {
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-request-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  };
}
export async function readBytes(req: Request, limit = 8192) {
  if (!req.body) throw new HttpError(400, 'Falta el contenido de la solicitud.');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, 'El contenido supera el límite permitido.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
export async function readBody(req: Request, limit = 8192) {
  return new TextDecoder().decode(await readBytes(req, limit));
}
export async function readJson(req: Request, limit = 8192): Promise<Record<string, unknown>> {
  try {
    const data = JSON.parse(await readBody(req, limit));
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error();
    return data;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Solicitud inválida.');
  }
}
export async function requireUser(req: Request, runtime: Runtime) {
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new HttpError(401, 'Inicia sesión para continuar.');
  const { data, error } = await runtime.db.auth.getUser(token);
  if (error || !data.user)
    throw new HttpError(401, 'Tu sesión no es válida. Vuelve a iniciar sesión.');
  return data.user;
}
export async function withBillingLock<T>(
  r: Runtime,
  userId: string,
  action: (token: string) => Promise<T>,
): Promise<T> {
  const token = crypto.randomUUID();
  const lock = checked(
    await r.db.rpc('acquire_billing_lock', { p_user_id: userId, p_token: token }),
  );
  if (!lock.data)
    throw new HttpError(409, 'Hay otra actualización en curso. Reintenta en unos segundos.');
  try {
    return await action(token);
  } finally {
    await r.db.rpc('release_billing_lock', { p_user_id: userId, p_token: token });
  }
}
export async function account(r: Runtime, userId: string) {
  checked(
    await r.db
      .from('billing_accounts')
      .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true }),
  );
  const { data } = checked(
    await r.db.from('billing_accounts').select('stripe_customer_id').eq('user_id', userId).single(),
  );
  if (!data) throw new HttpError(503, 'No pudimos cargar la cuenta de facturación.');
  return data.stripe_customer_id as string | null;
}
export async function reconcile(
  r: Runtime,
  userId: string,
  customer: string | null,
  token: string,
) {
  const snapshots: (SubscriptionSnapshot & { price_id: string | null })[] = [];
  if (customer) {
    // Retrieve live state under the same lock used by billing mutations and webhooks.
    // Event timestamps/order never decide the customer's current permissions.
    for await (const subscription of r.stripe.subscriptions.list({
      customer,
      status: 'all',
      limit: 100,
    })) {
      const item = subscription.items.data[0];
      const price = item?.price.id;
      const plan =
        subscription.items.data.length === 1 && item.quantity === 1
          ? price === r.config.proPrice
            ? 'pro'
            : price === r.config.plusPrice
              ? 'plus'
              : null
          : null;
      const end = item?.current_period_end;
      snapshots.push({
        id: subscription.id,
        price_id: price || null,
        plan,
        status: subscription.pause_collection ? 'paused' : subscription.status,
        current_period_end: end ? new Date(end * 1000).toISOString() : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
      });
    }
  }
  checked(
    await r.db.rpc('replace_billing_subscriptions', {
      p_user_id: userId,
      p_token: token,
      p_subscriptions: snapshots,
    }),
  );
  return snapshots;
}
export async function catalog(r: Runtime) {
  return Promise.all(
    (['pro', 'plus'] as const).map(async (plan) => {
      const price = await r.stripe.prices.retrieve(
        plan === 'pro' ? r.config.proPrice : r.config.plusPrice,
      );
      if (
        !price.active ||
        price.type !== 'recurring' ||
        price.recurring?.interval !== 'month' ||
        price.recurring.interval_count !== 1 ||
        price.billing_scheme !== 'per_unit' ||
        price.unit_amount !== PLANS[plan].monthlyPrice.amount ||
        price.currency !== PLANS[plan].monthlyPrice.currency ||
        price.recurring.usage_type !== 'licensed'
      )
        throw new HttpError(503, 'Los planes no están disponibles todavía.');
      return { plan, amount: price.unit_amount, currency: price.currency, interval: 'month' };
    }),
  );
}
export async function status(r: Runtime, userId: string) {
  const subscriptions = await withBillingLock(r, userId, async (token) =>
    reconcile(r, userId, await account(r, userId), token),
  );
  const month = new Date().toISOString().slice(0, 7) + '-01';
  const { data } = checked(
    await r.db
      .from('billing_usage')
      .select('used')
      .eq('user_id', userId)
      .eq('month', month)
      .maybeSingle(),
  );
  const consumption = checked(
    await r.db
      .from('service_consumption')
      .select('tokens,audio_seconds')
      .eq('user_id', userId)
      .eq('month', month)
      .maybeSingle(),
  );
  const now = new Date();
  const plan = effectivePlan(subscriptions);
  return {
    plan,
    subscriptions,
    consumption: {
      tokens: Number(consumption.data?.tokens || 0),
      tokenLimit: PLANS[plan].tokens,
      audioSeconds: consumption.data?.audio_seconds || 0,
      audioLimit: PLANS[plan].audioSeconds,
    },
    used: data?.used || 0,
    limit: PLANS[plan].aiRequests,
    resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
    canManage: Boolean(await account(r, userId)),
    prices: await catalog(r),
  };
}
export async function checkout(r: Runtime, user: { id: string; email?: string }, plan: unknown) {
  if (plan !== 'pro' && plan !== 'plus') throw new HttpError(400, 'Plan inválido.');
  await catalog(r);
  return withBillingLock(r, user.id, async (token) => {
    let customer = await account(r, user.id);
    if (!customer) {
      const created = await r.stripe.customers.create(
        { email: user.email, metadata: { glu_user_id: user.id } },
        { idempotencyKey: `glu-customer-${user.id}` },
      );
      customer = created.id;
      checked(
        await r.db
          .from('billing_accounts')
          .update({ stripe_customer_id: customer })
          .eq('user_id', user.id),
      );
    }
    const subscriptions = await reconcile(r, user.id, customer, token);
    if (subscriptions.some((s) => blocksCheckout(s.status)))
      throw new HttpError(
        409,
        'Ya tienes una suscripción. Usa Gestionar pagos para cambiar de plan o resolver un pago pendiente.',
      );
    // Reuse open Checkout sessions, including requests whose original response was lost.
    for await (const open of r.stripe.checkout.sessions.list({
      customer,
      status: 'open',
      limit: 100,
    })) {
      if (open.mode !== 'subscription') continue;
      if (open.metadata?.glu_plan === plan && open.url) return { url: open.url };
      await r.stripe.checkout.sessions.expire(open.id);
    }
    const session = await r.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: user.id,
      line_items: [{ price: plan === 'pro' ? r.config.proPrice : r.config.plusPrice, quantity: 1 }],
      metadata: { glu_plan: plan },
      subscription_data: { metadata: { glu_user_id: user.id } },
      success_url: r.config.returnUrl,
      cancel_url: r.config.returnUrl,
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });
    if (!session.url) throw new HttpError(502, 'Stripe no devolvió una página de pago.');
    return { url: session.url };
  });
}
export async function portal(r: Runtime, userId: string) {
  const customer = await account(r, userId);
  if (!customer) throw new HttpError(409, 'Todavía no tienes una cuenta de facturación.');
  const session = await r.stripe.billingPortal.sessions.create({
    customer,
    return_url: r.config.returnUrl,
    configuration: r.config.portalConfiguration,
  });
  return { url: session.url };
}
export async function cancel(r: Runtime, userId: string, resume: boolean) {
  return withBillingLock(r, userId, async (token) => {
    const customer = await account(r, userId);
    const subscriptions = await reconcile(r, userId, customer, token);
    const current = subscriptions.filter((s) => blocksCheckout(s.status));
    if (current.length !== 1 || !['active', 'trialing', 'past_due'].includes(current[0].status))
      throw new HttpError(409, 'Gestiona esta suscripción desde el portal de pagos.');
    // The subscription ID is derived from the authenticated user's customer, never input.
    await r.stripe.subscriptions.update(current[0].id, { cancel_at_period_end: !resume });
    return { subscriptions: await reconcile(r, userId, customer, token) };
  });
}
export async function authorizeFeature(
  r: Runtime,
  userId: string,
  feature: PaidFeature,
  consume = false,
) {
  return withBillingLock(r, userId, async (token) => {
    const subscriptions = await reconcile(r, userId, await account(r, userId), token);
    const plan = effectivePlan(subscriptions);
    if (!hasFeature(plan, feature))
      throw new HttpError(
        402,
        feature === 'knowledge'
          ? 'Necesitas el plan Plus activo para preguntar a tus reuniones.'
          : 'Necesitas un plan Pro o Plus activo para generar resúmenes.',
      );
    if (!consume && feature !== 'transcription') {
      const month = new Date().toISOString().slice(0, 7) + '-01';
      const usage = checked(
        await r.db
          .from('billing_usage')
          .select('used')
          .eq('user_id', userId)
          .eq('month', month)
          .maybeSingle(),
      );
      if ((usage.data?.used || 0) >= PLANS[plan].aiRequests)
        throw new HttpError(429, 'Agotaste las solicitudes de IA de este mes. Revisa tu plan.');
    }
    if (consume) {
      const reservation = checked(
        await r.db.rpc('reserve_ai_request', {
          p_user_id: userId,
          p_limit: PLANS[plan].aiRequests,
        }),
      );
      if (reservation.data === null)
        throw new HttpError(429, 'Agotaste las solicitudes de IA de este mes. Revisa tu plan.');
    }
    return plan;
  });
}
export function responseError(error: unknown, headers: HeadersInit = {}) {
  const status = error instanceof HttpError ? error.status : 503;
  // Never disclose Stripe secrets, provider response bodies, or meeting contents.
  return Response.json(
    {
      error:
        error instanceof HttpError
          ? error.message
          : 'El servicio no está disponible. Reintenta en unos momentos.',
    },
    { status, headers },
  );
}
export function billingHandler(r: Runtime) {
  return async (req: Request) => {
    let headers: HeadersInit = {};
    try {
      headers = cors(req, r);
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido.');
      const user = await requireUser(req, r);
      const body = await readJson(req);
      let result: unknown;
      switch (body.action) {
        case 'status':
          result = await status(r, user.id);
          break;
        case 'checkout':
          result = await checkout(r, user, body.plan);
          break;
        case 'portal':
          result = await portal(r, user.id);
          break;
        case 'cancel':
          result = await cancel(r, user.id, false);
          break;
        case 'resume':
          result = await cancel(r, user.id, true);
          break;
        case 'authorize':
          if (
            body.feature !== 'summary' &&
            body.feature !== 'knowledge' &&
            body.feature !== 'transcription'
          )
            throw new HttpError(400, 'Función inválida.');
          await authorizeFeature(r, user.id, body.feature);
          result = { allowed: true };
          break;
        default:
          throw new HttpError(400, 'Acción inválida.');
      }
      return Response.json(result, { headers });
    } catch (error) {
      return responseError(error, headers);
    }
  };
}
