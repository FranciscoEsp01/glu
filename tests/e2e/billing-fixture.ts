import type { Page } from '@playwright/test';
import type { BillingStatus } from '../../supabase/functions/_shared/plans';
export function billingState(
  plan: 'free' | 'pro' | 'plus' = 'plus',
  paymentStatus = 'active',
): BillingStatus {
  const paid = plan !== 'free' && ['active', 'trialing'].includes(paymentStatus);
  return {
    plan: paid ? plan : 'free',
    used: 0,
    consumption: {
      tokens: 1200,
      tokenLimit: paid ? (plan === 'plus' ? 10000000 : 2000000) : 0,
      audioSeconds: 120,
      audioLimit: paid ? (plan === 'plus' ? 90000 : 18000) : 0,
    },
    limit: paid ? (plan === 'plus' ? 500 : 100) : 0,
    canManage: plan !== 'free',
    resetsAt: new Date(Date.now() + 86400000).toISOString(),
    subscriptions:
      plan === 'free'
        ? []
        : [
            {
              id: 'sub_test',
              plan,
              status: paymentStatus,
              current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
              cancel_at_period_end: false,
            },
          ],
    prices: [
      { plan: 'pro', amount: 1500, currency: 'usd', interval: 'month' },
      { plan: 'plus', amount: 2500, currency: 'usd', interval: 'month' },
    ],
  };
}
export async function mockBilling(page: Page, state = billingState()) {
  const calls: Record<string, unknown>[] = [];
  await page.route('https://glu-test.supabase.co/functions/v1/billing', async (route) => {
    const body = route.request().postDataJSON();
    calls.push(body);
    if (body.action === 'status') return route.fulfill({ json: state });
    if (body.action === 'authorize')
      return route.fulfill(
        state.plan === 'free'
          ? {
              status: 402,
              json: { error: 'Necesitas un plan Pro o Plus activo para generar resúmenes.' },
            }
          : { json: { allowed: true } },
      );
    if (body.action === 'cancel' || body.action === 'resume') {
      state.subscriptions[0].cancel_at_period_end = body.action === 'cancel';
      return route.fulfill({ json: { subscriptions: state.subscriptions } });
    }
    return route.fulfill({
      json: {
        url:
          body.action === 'portal'
            ? 'https://billing.stripe.com/p/session/test'
            : 'https://checkout.stripe.com/c/pay/test',
      },
    });
  });
  return calls;
}
