import { operationsHandler } from '../supabase/functions/_shared/operations-admin';
import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import Stripe from 'stripe';
import { billingHandler, type Runtime } from '../supabase/functions/_shared/billing-core';
import { transcriptionHandler } from '../supabase/functions/_shared/transcription';
import { paidAIHandler } from '../supabase/functions/_shared/paid-ai';
import { webhookHandler } from '../supabase/functions/_shared/webhook';
import { effectivePlan } from '../supabase/functions/_shared/plans';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const sdk = new Stripe('sk_test_not_a_real_key');
let pg: PGlite;
let subscriptions: any[];
let checkoutCalls: any[];
let updateCalls: any[];
let sessions: any[];
let providerCalls: number;
let stripeFailure: boolean;
let r: Runtime;

// A small Supabase query adapter backed by actual PostgreSQL for handler tests.
class Query {
  conditions: [string, unknown][] = [];
  columns = '*';
  operation = 'select';
  value: any;
  options: any;
  one = false;
  constructor(private table: string) {}
  select(columns = '*') {
    this.columns = columns;
    return this;
  }
  eq(key: string, value: unknown) {
    this.conditions.push([key, value]);
    return this;
  }
  maybeSingle() {
    this.one = true;
    return this;
  }
  single() {
    this.one = true;
    return this;
  }
  upsert(value: any, options?: any) {
    this.operation = 'upsert';
    this.value = value;
    this.options = options;
    return this;
  }
  update(value: any) {
    this.operation = 'update';
    this.value = value;
    return this;
  }
  async then(resolve: any, reject: any) {
    try {
      const params: unknown[] = [];
      const param = (value: unknown) => {
        params.push(value);
        return `$${params.length}`;
      };
      const where = () =>
        this.conditions.length
          ? ' where ' + this.conditions.map(([k, v]) => `${k} = ${param(v)}`).join(' and ')
          : '';
      let sql: string;
      if (this.operation === 'select')
        sql = `select ${this.columns} from public.${this.table}${where()}`;
      else if (this.operation === 'update')
        sql = `update public.${this.table} set ${Object.entries(this.value)
          .map(([k, v]) => `${k} = ${param(v)}`)
          .join(',')}${where()} returning *`;
      else
        sql = `insert into public.${this.table} (${Object.keys(this.value).join(',')}) values (${Object.values(this.value).map(param).join(',')}) on conflict (${this.options?.onConflict || 'id'}) do nothing returning *`;
      const result = await pg.query(sql, params);
      return resolve({ data: this.one ? result.rows[0] || null : result.rows, error: null });
    } catch (error) {
      return resolve({ data: null, error });
    }
  }
}
before(async () => {
  pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth, public to authenticated, anon, service_role;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${A}'), ('${B}');`);
  await pg.exec(
    await readFile(
      new URL('../supabase/migrations/202610010001_billing.sql', import.meta.url),
      'utf8',
    ),
  );
  await pg.exec(
    await readFile(
      new URL('../supabase/migrations/202610040001_consumption.sql', import.meta.url),
      'utf8',
    ),
  );
  await pg.exec(
    await readFile(
      new URL('../supabase/migrations/202610040002_processing.sql', import.meta.url),
      'utf8',
    ),
  );
  await pg.exec(
    await readFile(
      new URL('../supabase/migrations/202610040003_operations.sql', import.meta.url),
      'utf8',
    ),
  );
});
after(async () => {
  await pg.close();
});
beforeEach(async () => {
  await pg.exec(
    'truncate public.operator_accounts, public.operational_alerts, public.service_requests, public.service_consumption, public.billing_accounts, public.billing_subscriptions, public.billing_usage, public.billing_events, public.billing_locks cascade',
  );
  subscriptions = [];
  checkoutCalls = [];
  updateCalls = [];
  sessions = [];
  providerCalls = 0;
  stripeFailure = false;
  const db = {
    auth: {
      getUser: async (token: string) => ({
        data: {
          user:
            token === 'token-a'
              ? { id: A, email: 'a@example.com' }
              : token === 'token-b'
                ? { id: B, email: 'b@example.com' }
                : null,
        },
        error: null,
      }),
    },
    from: (table: string) => new Query(table),
    rpc: async (name: string, args: Record<string, unknown>) => {
      try {
        const result = await pg.query(
          `select public.${name}(${Object.keys(args)
            .map((_, i) => `$${i + 1}`)
            .join(',')}) as value`,
          Object.values(args).map((v) => (Array.isArray(v) ? JSON.stringify(v) : v)),
        );
        return { data: (result.rows[0] as any)?.value, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  };
  const stripe = {
    webhooks: sdk.webhooks,
    customers: { create: async () => ({ id: 'cus_a' }) },
    prices: {
      retrieve: async (id: string) => ({
        active: true,
        type: 'recurring',
        recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
        billing_scheme: 'per_unit',
        unit_amount: id === 'price_pro' ? 1500 : 2500,
        currency: 'usd',
      }),
    },
    subscriptions: {
      list: ({ customer }: any) =>
        (async function* () {
          if (stripeFailure) throw new Error('Stripe offline');
          yield* subscriptions.filter((s) => s.customer === customer);
        })(),
      update: async (id: string, update: any) => {
        updateCalls.push({ id, ...update });
        Object.assign(
          subscriptions.find((s) => s.id === id),
          update,
        );
      },
    },
    checkout: {
      sessions: {
        list: ({ customer }: any) =>
          (async function* () {
            yield* sessions.filter((s) => s.customer === customer && s.status === 'open');
          })(),
        expire: async (id: string) => {
          sessions.find((s) => s.id === id).status = 'expired';
        },
        create: async (body: any) => {
          checkoutCalls.push(body);
          const s = {
            id: 'cs_a',
            status: 'open',
            url: 'https://checkout.stripe.com/c/pay/cs_a',
            ...body,
          };
          sessions.push(s);
          return s;
        },
      },
    },
    billingPortal: {
      sessions: {
        create: async ({ customer }: any) => ({
          url: `https://billing.stripe.com/p/session/${customer}`,
        }),
      },
    },
  };
  r = {
    db,
    stripe,
    config: {
      proPrice: 'price_pro',
      plusPrice: 'price_plus',
      returnUrl: 'https://glu.example/',
      portalConfiguration: 'bpc_test',
      webhookSecret: 'whsec_test',
      origins: ['https://glu.example'],
      geminiKey: 'server-secret',
      geminiModel: 'gemini-2.5-flash',
      deepgramKey: 'server-deepgram',
    },
    fetch: async () => {
      providerCalls++;
      return Response.json({ candidates: [{ content: { parts: [{ text: '{}' }] } }] });
    },
  } as unknown as Runtime;
});
async function subscriber(id = A, status = 'active', plan = 'pro') {
  const customer = id === A ? 'cus_a' : 'cus_b';
  await pg.query('insert into billing_accounts values ($1,$2)', [id, customer]);
  subscriptions.push({
    id: id === A ? 'sub_a' : 'sub_b',
    customer,
    status,
    cancel_at_period_end: false,
    items: {
      data: [
        {
          price: { id: `price_${plan}` },
          quantity: 1,
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
        },
      ],
    },
  });
}
const request = (body: unknown, token = 'token-a') =>
  new Request('https://edge.example/functions/v1/billing', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Origin: 'https://glu.example',
    },
    body: JSON.stringify(body),
  });
const payload = {
  title: 'Reunión',
  templateType: 'general',
  manualNotes: 'Un acuerdo',
  transcript: [],
};
async function event(type: string, id = 'evt_test', customer = 'cus_a') {
  const body = JSON.stringify({
    id,
    type,
    created: 1,
    data: { object: { id: 'sub_a', customer, status: 'active' } },
  });
  const signature = sdk.webhooks.generateTestHeaderString({
    payload: body,
    secret: r.config.webhookSecret,
  });
  return new Request('https://edge.example/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body,
  });
}

test('Billing endpoints reject missing/invalid sessions and disallowed origins', async () => {
  assert.equal((await billingHandler(r)(request({ action: 'status' }, 'forged'))).status, 401);
  const bad = request({ action: 'status' });
  bad.headers.set('origin', 'https://evil.example');
  assert.equal((await billingHandler(r)(bad)).status, 403);
});
test('Checkout uses server prices and authenticated customer, reuses open sessions', async () => {
  r.config.paymentMode = 'test';
  const status = await billingHandler(r)(request({ action: 'status', paymentMode: 'live' }));
  assert.equal((await status.json()).paymentMode, 'test');
  const body = {
    action: 'checkout',
    plan: 'pro',
    user_id: B,
    customer: 'cus_b',
    price: 'price_free',
    success_url: 'https://evil.example',
  };
  assert.equal((await billingHandler(r)(request(body))).status, 200);
  assert.equal((await billingHandler(r)(request(body))).status, 200);
  assert.equal(checkoutCalls.length, 1);
  assert.deepEqual(checkoutCalls[0].line_items, [{ price: 'price_pro', quantity: 1 }]);
  assert.equal(checkoutCalls[0].customer, 'cus_a');
  assert.equal(checkoutCalls[0].success_url, 'https://glu.example/');
  assert.equal(
    (await billingHandler(r)(request({ action: 'checkout', plan: 'enterprise' }))).status,
    400,
  );
});
test('Checkout rejects prices that differ from the published monthly USD plans', async () => {
  const retrieve = r.stripe.prices.retrieve.bind(r.stripe.prices);
  for (const change of [{ unit_amount: 1200 }, { currency: 'eur' }]) {
    r.stripe.prices.retrieve = (async (...args: any[]) => ({
      ...(await (retrieve as any)(...args)),
      ...change,
    })) as any;
    const response = await billingHandler(r)(request({ action: 'checkout', plan: 'pro' }));
    assert.equal(response.status, 503);
    assert.equal(checkoutCalls.length, 0);
  }
});

test('An existing delinquent subscription blocks another checkout', async () => {
  await subscriber(A, 'past_due');
  assert.equal(
    (await billingHandler(r)(request({ action: 'checkout', plan: 'plus' }))).status,
    409,
  );
  assert.equal(checkoutCalls.length, 0);
});
test('Cancellation and resumption affect only the owner and preserve access until period end', async () => {
  await subscriber();
  await subscriber(B);
  assert.equal(
    (await billingHandler(r)(request({ action: 'cancel', subscription_id: 'sub_b' }))).status,
    200,
  );
  assert.deepEqual(updateCalls[0], { id: 'sub_a', cancel_at_period_end: true });
  const state = await (await billingHandler(r)(request({ action: 'status' }))).json();
  assert.equal(state.plan, 'pro');
  assert.equal(state.subscriptions[0].cancel_at_period_end, true);
  assert.equal((await billingHandler(r)(request({ action: 'resume' }))).status, 200);
  assert.equal(updateCalls[1].cancel_at_period_end, false);
});
test('Server denies Free and Pro knowledge even if client claims Plus; never calls AI', async () => {
  assert.equal(
    (await paidAIHandler(r)(request({ feature: 'summary', payload, plan: 'plus' }))).status,
    402,
  );
  await pg.exec('truncate billing_accounts cascade');
  await subscriber();
  assert.equal(
    (
      await paidAIHandler(r)(
        request({
          feature: 'knowledge',
          question: 'Qué',
          evidence: [{ id: '1', text: 'Evidencia' }],
          plan: 'plus',
        }),
      )
    ).status,
    402,
  );
  assert.equal(providerCalls, 0);
});
test('Paid AI consumes quota atomically, enforces it and uses server-owned credentials', async () => {
  await subscriber();
  const month = new Date().toISOString().slice(0, 7) + '-01';
  await pg.query('insert into billing_usage values ($1,$2,99)', [A, month]);
  assert.equal(
    (await paidAIHandler(r)(request({ feature: 'summary', payload, geminiKey: 'attacker' })))
      .status,
    200,
  );
  assert.equal((await paidAIHandler(r)(request({ feature: 'summary', payload }))).status, 429);
  assert.equal(providerCalls, 1);
});
test('Failed payments revoke premium access and payment recovery restores it', async () => {
  await subscriber(A, 'past_due');
  assert.equal((await webhookHandler(r)(await event('invoice.payment_failed'))).status, 200);
  assert.equal((await paidAIHandler(r)(request({ feature: 'summary', payload }))).status, 402);
  subscriptions[0].status = 'active';
  assert.equal((await webhookHandler(r)(await event('invoice.paid', 'evt_paid'))).status, 200);
  assert.equal((await paidAIHandler(r)(request({ feature: 'summary', payload }))).status, 200);
});
test('Webhooks reject bad signatures; duplicates and old events cannot reactivate canceled access', async () => {
  await subscriber(A, 'canceled');
  assert.equal(
    (
      await webhookHandler(r)(
        new Request('https://edge.example', {
          method: 'POST',
          headers: { 'stripe-signature': 'invalid' },
          body: '{}',
        }),
      )
    ).status,
    400,
  );
  assert.equal((await webhookHandler(r)(await event('customer.subscription.updated'))).status, 200);
  assert.equal((await webhookHandler(r)(await event('customer.subscription.updated'))).status, 200);
  const result = await pg.query('select status from billing_subscriptions');
  assert.equal((result.rows[0] as any).status, 'canceled');
  assert.equal((await pg.query('select * from billing_events')).rows.length, 1);
  assert.equal(providerCalls, 0);
});
test('Stripe outages fail closed and webhooks remain retryable', async () => {
  await subscriber();
  stripeFailure = true;
  assert.equal((await paidAIHandler(r)(request({ feature: 'summary', payload }))).status, 503);
  assert.equal((await webhookHandler(r)(await event('invoice.paid'))).status, 503);
  assert.equal((await pg.query('select * from billing_events')).rows.length, 0);
  assert.equal(providerCalls, 0);
});
test('RLS hides other accounts and clients cannot change plans or reserve quotas', async () => {
  await subscriber();
  await subscriber(B);
  await pg.exec(`set role authenticated; set request.jwt.claim.sub = '${A}';`);
  try {
    const visible = await pg.query('select user_id from billing_accounts');
    assert.deepEqual(visible.rows, [{ user_id: A }]);
    await assert.rejects(pg.query("update billing_accounts set stripe_customer_id='cus_hacked'"));
    await assert.rejects(pg.query('select reserve_ai_request($1, 500)', [A]));
    await assert.rejects(pg.query('select * from billing_events'));
  } finally {
    await pg.exec('reset role');
  }
});
test('Lease ownership and quota exhaustion are enforced in PostgreSQL', async () => {
  const first = crypto.randomUUID(),
    second = crypto.randomUUID();
  assert.equal(
    (await pg.query('select acquire_billing_lock($1,$2) as ok', [A, first])).rows[0].ok,
    true,
  );
  assert.equal(
    (await pg.query('select acquire_billing_lock($1,$2) as ok', [A, second])).rows[0].ok,
    false,
  );
  await assert.rejects(
    pg.query('select replace_billing_subscriptions($1,$2,$3)', [A, second, '[]']),
  );
  const results = await Promise.all(
    Array.from({ length: 10 }, () => pg.query('select reserve_ai_request($1,3) as used', [A])),
  );
  assert.equal(results.filter((result) => result.rows[0].used !== null).length, 3);
});
test('Unknown prices, expired periods and unpaid statuses never grant paid access', () => {
  for (const status of [
    'past_due',
    'unpaid',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'paused',
  ])
    assert.equal(
      effectivePlan([
        {
          id: 'sub',
          plan: 'plus',
          status,
          current_period_end: new Date(Date.now() + 10000).toISOString(),
          cancel_at_period_end: false,
        },
      ]),
      'free',
    );
  assert.equal(
    effectivePlan([
      {
        id: 'sub',
        plan: 'pro',
        status: 'active',
        current_period_end: '2020-01-01',
        cancel_at_period_end: false,
      },
    ]),
    'free',
  );
});

test('Measured Gemini tokens settle the reservation once and are visible only to the owner', async () => {
  await subscriber();
  r.fetch = async (_url, init) => {
    assert.equal((init?.headers as any)['x-goog-api-key'], 'server-secret');
    return Response.json({
      candidates: [],
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 30, totalTokenCount: 160 },
    });
  };
  const req = request({ feature: 'summary', payload });
  const id = crypto.randomUUID();
  req.headers.set('x-request-id', id);
  assert.equal((await paidAIHandler(r)(req)).status, 200);
  const row = (await pg.query('select * from service_consumption')).rows[0] as any;
  assert.equal(Number(row.tokens), 160);
  assert.equal(
    (await pg.query('select status,measurement from service_requests')).rows[0]?.status,
    'succeeded',
  );
  await pg.query('select finish_service_request($1,$2,true,120,30,160,200)', [A, id]);
  assert.equal(
    Number((await pg.query('select tokens from service_consumption')).rows[0]?.tokens),
    160,
  );
  await pg.exec(`set role authenticated; set request.jwt.claim.sub='${B}';`);
  try {
    assert.equal((await pg.query('select * from service_requests')).rows.length, 0);
    await assert.rejects(pg.query('update service_consumption set tokens=0'));
    await assert.rejects(pg.query('select finish_service_request($1,$2,true,0,0,0,200)', [A, id]));
  } finally {
    await pg.exec('reset role');
  }
});

test('Provider failures keep a conservative charge and duplicate requests never call Gemini twice', async () => {
  await subscriber();
  providerCalls = 0;
  r.fetch = async () => {
    providerCalls++;
    return new Response(null, { status: 500 });
  };
  const id = crypto.randomUUID();
  const first = request({ feature: 'summary', payload });
  first.headers.set('x-request-id', id);
  assert.equal((await paidAIHandler(r)(first)).status, 502);
  const retry = request({ feature: 'summary', payload });
  retry.headers.set('x-request-id', id);
  assert.equal((await paidAIHandler(r)(retry)).status, 409);
  assert.equal(providerCalls, 1);
  const row = (await pg.query('select * from service_requests')).rows[0] as any;
  assert.equal(row.status, 'failed');
  assert.equal(row.measurement, 'reserved');
  assert.ok(row.reserved_tokens >= 8192);
});

test('Atomic reservations enforce token, audio, concurrency and burst limits', async () => {
  const call = (id: string, tokens = 100, audio = 0) =>
    pg.query('select reserve_service_request($1,$2,$3,100,1000,300,$4,$5) as result', [
      A,
      id,
      audio ? 'transcription' : 'summary',
      tokens,
      audio,
    ]);
  assert.equal((await call(crypto.randomUUID(), 1001)).rows[0]?.result, 'quota');
  assert.equal((await call(crypto.randomUUID(), 0, 300)).rows[0]?.result, 'ok');
  assert.equal((await call(crypto.randomUUID(), 0, 1)).rows[0]?.result, 'quota');
  assert.equal((await call(crypto.randomUUID())).rows[0]?.result, 'ok');
  assert.equal((await call(crypto.randomUUID())).rows[0]?.result, 'concurrency');
  await pg.exec("update service_requests set status='succeeded'");
  for (let i = 0; i < 8; i++) {
    assert.equal((await call(crypto.randomUUID(), 1)).rows[0]?.result, 'ok');
    await pg.exec("update service_requests set status='succeeded'");
  }
  assert.equal((await call(crypto.randomUUID(), 1)).rows[0]?.result, 'rate');
});

test('Managed transcription measures fixed PCM bytes, applies the plan and never accepts a client credential', async () => {
  const audio = new Uint8Array(64000);
  const req = () =>
    new Request('https://edge.example/transcribe?language=es', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-a',
        Origin: 'https://glu.example',
        'Content-Type': 'application/octet-stream',
      },
      body: audio,
    });
  assert.equal((await transcriptionHandler(r)(req())).status, 402);
  assert.equal(providerCalls, 0);
  await pg.query('delete from billing_accounts where user_id=$1', [A]);
  await subscriber();
  r.fetch = async (url, init) => {
    providerCalls++;
    assert.ok(String(url).includes('encoding=linear16'));
    assert.equal((init?.headers as any).Authorization, 'Token server-deepgram');
    return Response.json({ results: { utterances: [] } });
  };
  assert.equal((await transcriptionHandler(r)(req())).status, 200);
  assert.equal(
    (await pg.query('select audio_seconds from service_consumption')).rows[0]?.audio_seconds,
    2,
  );
  assert.equal((await pg.query('select used from billing_usage')).rows.length, 0);
  const malformed = new Request('https://edge.example/transcribe', {
    method: 'POST',
    headers: { Authorization: 'Bearer token-a', 'Content-Type': 'audio/webm' },
    body: audio,
  });
  assert.equal((await transcriptionHandler(r)(malformed)).status, 415);
  assert.equal(providerCalls, 1);
});

test('A lost response is recovered by its owner without another provider call or quota reservation', async () => {
  await subscriber();
  const result = {
    candidates: [{ content: { parts: [{ text: '{"title":"Guardado"}' }] } }],
    usageMetadata: { totalTokenCount: 42 },
  };
  r.fetch = async () => {
    providerCalls++;
    return Response.json(result);
  };
  const id = crypto.randomUUID();
  const call = (data: any = { feature: 'summary', payload }, token = 'token-a') => {
    const req = request(data, token);
    req.headers.set('x-request-id', id);
    return paidAIHandler(r)(req);
  };
  const first = await call();
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), result);
  const recovered = await call();
  assert.equal(recovered.status, 200);
  assert.deepEqual(await recovered.json(), result);
  assert.equal(providerCalls, 1);
  assert.equal(
    Number((await pg.query('select tokens from service_consumption')).rows[0]?.tokens),
    42,
  );
  assert.equal(
    (await call({ feature: 'summary', payload: { ...payload, title: 'Otro contenido' } })).status,
    409,
  );
  const other = await call(undefined, 'token-b');
  assert.notEqual(other.status, 200);
  await pg.exec(`set role authenticated;set request.jwt.claim.sub='${A}';`);
  try {
    await assert.rejects(pg.query('select * from service_results'));
  } finally {
    await pg.exec('reset role');
  }
  await pg.query("update service_results set expires_at=now()-interval '1 second' where id=$1", [
    id,
  ]);
  const expired = await call();
  assert.equal(expired.status, 410);
  assert.equal(providerCalls, 1);
});

test('Concurrent requests report running; an interrupted operation is never blindly sent again', async () => {
  await subscriber();
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const reached = new Promise<void>((resolve) => {
    started = resolve;
  });
  r.fetch = async () => {
    providerCalls++;
    started();
    await waiting;
    return Response.json({ candidates: [] });
  };
  const id = crypto.randomUUID();
  const call = () => {
    const req = request({ feature: 'summary', payload });
    req.headers.set('x-request-id', id);
    return paidAIHandler(r)(req);
  };
  const first = call();
  await reached;
  assert.equal((await call()).status, 202);
  await pg.query("update service_requests set created_at=now()-interval '6 minutes' where id=$1", [
    id,
  ]);
  const unknown = await call();
  assert.equal(unknown.status, 409);
  assert.equal((await unknown.json()).code, 'operation_unknown');
  assert.equal(providerCalls, 1);
  release();
  assert.equal((await first).status, 200);
});

test('Transcription results survive lost delivery and are bound to audio bytes and language', async () => {
  await subscriber();
  r.config.deepgramKey = 'server-deepgram';
  const result = {
    results: { utterances: [{ speaker: 0, start: 0, end: 1, transcript: 'Hola' }] },
  };
  r.fetch = async () => {
    providerCalls++;
    return Response.json(result);
  };
  const id = crypto.randomUUID();
  const call = (audio = new Uint8Array(32000), language = 'es') =>
    transcriptionHandler(r)(
      new Request(`https://edge.example/transcribe?language=${language}`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-a',
          'content-type': 'application/octet-stream',
          'x-request-id': id,
        },
        body: audio,
      }),
    );
  assert.equal((await call()).status, 200);
  const recovered = await call();
  assert.deepEqual(await recovered.json(), result);
  assert.equal(providerCalls, 1);
  assert.equal((await call(new Uint8Array(64000))).status, 409);
  assert.equal((await call(undefined, 'en')).status, 409);
  assert.equal(
    Number(
      (await pg.query('select audio_seconds from service_consumption')).rows[0]?.audio_seconds,
    ),
    1,
  );
});

test('Uncertain provider delivery and a failed result commit do not allow a fresh paid operation', async () => {
  await subscriber();
  r.fetch = async () => {
    providerCalls++;
    throw new Error('connection dropped');
  };
  const id = crypto.randomUUID();
  const call = () => {
    const req = request({ feature: 'summary', payload });
    req.headers.set('x-request-id', id);
    return paidAIHandler(r)(req);
  };
  const failed = await call();
  const body = await failed.json();
  assert.equal(body.retryable, false);
  assert.equal(body.code, 'operation_unknown');
  const retry = await call();
  assert.equal((await retry.json()).newOperation, false);
  assert.equal(providerCalls, 1);
  const id2 = crypto.randomUUID();
  const rpc = r.db.rpc.bind(r.db);
  r.db.rpc = (async (name: string, args: any) =>
    name === 'finish_service_operation'
      ? { error: { message: 'database down' }, data: null }
      : rpc(name, args)) as any;
  r.fetch = async () => {
    providerCalls++;
    return Response.json({ candidates: [] });
  };
  const req = request({ feature: 'summary', payload });
  req.headers.set('x-request-id', id2);
  assert.equal((await paidAIHandler(r)(req)).status, 503);
  const duplicate = request({ feature: 'summary', payload });
  duplicate.headers.set('x-request-id', id2);
  assert.equal((await paidAIHandler(r)(duplicate)).status, 202);
  assert.equal(providerCalls, 2);
});

test('Operations data and acknowledgement require explicit server-provisioned operator access', async () => {
  const handler = operationsHandler(r);
  assert.equal((await handler(request({ action: 'snapshot' }, 'forged'))).status, 401);
  assert.equal((await handler(request({ action: 'snapshot' }))).status, 403);
  await pg.query('insert into operator_accounts(user_id) values($1)', [A]);
  await subscriber();
  const pending = request({ feature: 'summary', payload });
  pending.headers.set('x-request-id', crypto.randomUUID());
  r.fetch = async () => {
    throw new Error('lost provider response');
  };
  await paidAIHandler(r)(pending);
  await pg.exec(
    "update service_requests set status='pending',created_at=now()-interval '10 minutes';",
  );
  const response = await handler(request({ action: 'snapshot' }));
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.equal(snapshot.alerts[0].key, 'interrupted_operations');
  assert.equal(snapshot.accounts[0].estimatedCostUSD, null);
  assert.equal(snapshot.requests[0].status, 'pending');
  assert.equal((await handler(request({ action: 'snapshot' }, 'token-b'))).status, 403);
  assert.equal(
    (await handler(request({ action: 'acknowledge', key: 'interrupted_operations' }))).status,
    200,
  );
  assert.equal((await handler(request({ action: 'acknowledge', key: 'not-valid' }))).status, 400);
  await pg.exec(`set role authenticated;set request.jwt.claim.sub='${B}';`);
  try {
    assert.equal((await pg.query('select * from operator_accounts')).rows.length, 0);
    await assert.rejects(pg.query('insert into operator_accounts(user_id) values($1)', [B]));
    await assert.rejects(pg.query('select operations_snapshot($1)', [A]));
    await assert.rejects(pg.query('select * from operational_alerts'));
  } finally {
    await pg.exec('reset role');
  }
});
