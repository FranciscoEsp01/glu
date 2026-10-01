import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import Stripe from 'stripe';
import { billingHandler, type Runtime } from '../supabase/functions/_shared/billing-core';
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
});
after(async () => {
  await pg.close();
});
beforeEach(async () => {
  await pg.exec(
    'truncate public.billing_accounts, public.billing_subscriptions, public.billing_usage, public.billing_events, public.billing_locks cascade',
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
      retrieve: async () => ({
        active: true,
        type: 'recurring',
        recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
        billing_scheme: 'per_unit',
        unit_amount: 1200,
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
