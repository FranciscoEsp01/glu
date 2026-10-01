import Stripe from 'stripe';
import {
  HttpError,
  readBody,
  reconcile,
  responseError,
  withBillingLock,
  type Runtime,
} from './billing-core.ts';
const supported = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
  'customer.deleted',
]);
export function webhookHandler(r: Runtime) {
  return async (req: Request) => {
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido.');
      const signature = req.headers.get('stripe-signature');
      if (!signature) throw new HttpError(400, 'Firma ausente.');
      const raw = await readBody(req, 1024 * 1024);
      let event: Stripe.Event;
      try {
        event = await r.stripe.webhooks.constructEventAsync(
          raw,
          signature,
          r.config.webhookSecret,
          undefined,
          Stripe.createSubtleCryptoProvider(),
        );
      } catch {
        throw new HttpError(400, 'Firma inválida.');
      }
      if (!supported.has(event.type)) return Response.json({ received: true });
      const previous = await r.db
        .from('billing_events')
        .select('id')
        .eq('id', event.id)
        .maybeSingle();
      if (previous.error) throw new Error('Cannot read events');
      if (previous.data) return Response.json({ received: true });
      const object = event.data.object as unknown as {
        id: string;
        customer?: string | { id: string } | null;
      };
      const customer =
        event.type === 'customer.deleted'
          ? object.id
          : typeof object.customer === 'string'
            ? object.customer
            : object.customer?.id;
      if (customer) {
        const owner = await r.db
          .from('billing_accounts')
          .select('user_id')
          .eq('stripe_customer_id', customer)
          .maybeSingle();
        if (owner.error) throw new Error('Cannot find owner');
        const userId = owner.data?.user_id;
        if (userId)
          await withBillingLock(r, userId, async (token) => {
            if (event.type === 'customer.deleted') {
              await reconcile(r, userId, null, token);
              const cleared = await r.db
                .from('billing_accounts')
                .update({ stripe_customer_id: null })
                .eq('user_id', userId);
              if (cleared.error) throw new Error('Cannot clear customer');
            } else await reconcile(r, userId, customer, token);
          });
      }
      // Persist only after successful reconciliation. Retrying a crash is safe:
      // reconciliation reads live Stripe state, never applies stale event data.
      const saved = await r.db
        .from('billing_events')
        .upsert(
          { id: event.id, event_type: event.type },
          { onConflict: 'id', ignoreDuplicates: true },
        );
      if (saved.error) throw new Error('Cannot record event');
      return Response.json({ received: true });
    } catch (error) {
      return responseError(error);
    }
  };
}
