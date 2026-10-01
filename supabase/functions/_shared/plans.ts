export type Plan = 'free' | 'pro' | 'plus';
export type PaidFeature = 'summary' | 'knowledge';
export const PLANS = {
  free: { name: 'Gratis', aiRequests: 0, features: [] as PaidFeature[] },
  pro: { name: 'Pro', aiRequests: 100, features: ['summary'] as PaidFeature[] },
  plus: { name: 'Plus', aiRequests: 500, features: ['summary', 'knowledge'] as PaidFeature[] },
};
export interface SubscriptionSnapshot {
  id: string;
  plan: Plan | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}
export function effectivePlan(subscriptions: SubscriptionSnapshot[], now = Date.now()): Plan {
  const valid = subscriptions.filter(
    (s) =>
      (s.status === 'active' || s.status === 'trialing') &&
      s.current_period_end &&
      Date.parse(s.current_period_end) > now,
  );
  if (valid.some((s) => s.plan === 'plus')) return 'plus';
  if (valid.some((s) => s.plan === 'pro')) return 'pro';
  return 'free';
}
export function hasFeature(plan: Plan, feature: PaidFeature) {
  return PLANS[plan].features.includes(feature);
}
export function blocksCheckout(status: string) {
  return !['canceled', 'incomplete_expired'].includes(status);
}
export function billingNotice(subscriptions: SubscriptionSnapshot[]) {
  if (subscriptions.some((s) => ['past_due', 'unpaid', 'incomplete'].includes(s.status)))
    return 'Hay un pago pendiente. Actualiza tu medio de pago para recuperar las funciones de tu plan.';
  if (
    subscriptions.some((s) => s.cancel_at_period_end && ['active', 'trialing'].includes(s.status))
  )
    return 'Tu suscripción no se renovará. Conservas las funciones hasta el final del período vigente.';
  if (subscriptions.some((s) => s.status === 'paused')) return 'Tu suscripción está pausada.';
  return '';
}
export interface BillingStatus {
  plan: Plan;
  subscriptions: SubscriptionSnapshot[];
  used: number;
  limit: number;
  resetsAt: string;
  canManage: boolean;
  prices: { plan: 'pro' | 'plus'; amount: number; currency: string; interval: string }[];
}
