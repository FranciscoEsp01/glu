import { useEffect, useState } from 'react';
import { Check, CreditCard, ExternalLink, RefreshCw } from 'lucide-react';
import {
  PLANS,
  billingNotice,
  billingRequest,
  openStripe,
  validStripeUrl,
  type Plan,
} from '../services/billing';
import { useBillingStore } from '../store/useBillingStore';
import { useMeetingStore } from '../store/useMeetingStore';
import { errorText } from '../lib/platform';

export function BillingModal() {
  const b = useBillingStore();
  const recording = useMeetingStore((s) => s.isRecording || s.isStarting || s.isProcessingAI);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!b.open) return;
    setError('');
    setLink('');
    setMessage('');
    setConfirmCancel(false);
    void b.refresh();
  }, [b.open]);
  if (!b.open) return null;
  const status = b.status;
  const current = status?.subscriptions.find(
    (s) => !['canceled', 'incomplete_expired'].includes(s.status),
  );
  const end = current?.current_period_end
    ? new Date(current.current_period_end).toLocaleDateString('es-CL')
    : null;
  async function action(action: string, plan?: Plan) {
    if (busy || recording) return;
    setBusy(true);
    setError('');
    setLink('');
    setMessage('');
    try {
      const result = await billingRequest<{ url?: string }>('billing', {
        action,
        ...(plan ? { plan } : {}),
      });
      if (result.url) {
        setLink(validStripeUrl(result.url));
        setMessage('Tu página de Stripe está lista. Ábrela para continuar.');
      } else {
        setMessage(
          action === 'cancel'
            ? 'Cancelación programada. Tu suscripción no se renovará.'
            : 'La renovación automática está activada.',
        );
        setConfirmCancel(false);
        await b.refresh();
      }
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || recording || b.loading || !status;
  return (
    <div className="modal-shade billing-shade">
      <section
        className="modal-card billing-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Plan y facturación"
      >
        <header>
          <div>
            <p className="eyebrow">CRECE CON GLU</p>
            <h2>Plan y facturación</h2>
          </div>
          <button aria-label="Cerrar facturación" disabled={busy} onClick={() => b.setOpen(false)}>
            ✕
          </button>
        </header>
        <p className="muted">
          Elige el espacio que necesitan tus ideas. Tu historial y tus exportaciones permanecen
          disponibles en todos los planes.
        </p>
        {b.loading && <p role="status">Consultando tu suscripción…</p>}
        {(error || b.error) && (
          <p className="notice error-notice" role="alert">
            {error || b.error}
          </p>
        )}
        {status && (
          <div className="billing-current">
            <CreditCard size={22} />
            <div>
              <strong>Plan actual: {PLANS[status.plan].name}</strong>
              <p>
                {status.limit
                  ? `${status.used} de ${status.limit} solicitudes de IA este mes`
                  : 'Notas, grabación e historial local'}
              </p>
              {status.consumption && (
                <>
                  <p>
                    {Math.ceil(status.consumption.audioSeconds / 60)} de{' '}
                    {status.consumption.audioLimit / 60} minutos de transcripción este mes
                  </p>
                  <p>
                    {status.consumption.tokens.toLocaleString('es-CL')} de{' '}
                    {status.consumption.tokenLimit.toLocaleString('es-CL')} tokens de IA este mes
                  </p>
                </>
              )}
              {end && (
                <p>
                  {current?.cancel_at_period_end ? 'Finaliza' : 'Fin del período actual'}: {end}
                </p>
              )}
            </div>
          </div>
        )}
        {status && billingNotice(status.subscriptions) && (
          <p className="notice" role="status">
            {billingNotice(status.subscriptions)}
          </p>
        )}
        <div className="billing-plans">
          {(['free', 'pro', 'plus'] as const).map((plan) => {
            const availablePrice = status?.prices.find((p) => p.plan === plan);
            const price = availablePrice || PLANS[plan].monthlyPrice;
            const amount = price
              ? new Intl.NumberFormat('es-CL', {
                  style: 'currency',
                  currency: price.currency.toUpperCase(),
                }).format(
                  price.amount /
                    10 **
                      new Intl.NumberFormat('en', {
                        style: 'currency',
                        currency: price.currency,
                      }).resolvedOptions().maximumFractionDigits!,
                )
              : null;
            return (
              <article
                className={`billing-plan ${status?.plan === plan ? 'selected' : ''}`}
                key={plan}
              >
                <h3>{PLANS[plan].name}</h3>
                <p className="billing-price">
                  {plan === 'free'
                    ? 'Sin costo'
                    : amount
                      ? `${amount} ${price!.currency.toUpperCase()}`
                      : 'Precio no disponible'}
                  {plan !== 'free' && amount && <small> / mes</small>}
                </p>
                <ul>
                  <li>
                    <Check size={14} /> Historial y exportaciones
                  </li>
                  <li>
                    <Check size={14} /> Grabación y notas locales
                  </li>
                  {plan !== 'free' && (
                    <>
                      <li>
                        <Check size={14} /> Transcripción y resúmenes con IA
                      </li>
                      <li>
                        <Check size={14} /> {PLANS[plan].aiRequests} solicitudes / mes
                      </li>
                    </>
                  )}
                  {plan === 'plus' && (
                    <li>
                      <Check size={14} /> Preguntas entre reuniones
                    </li>
                  )}
                </ul>
                {plan === 'free' ? (
                  <p className="muted">Siempre disponible</p>
                ) : (
                  <button
                    className="primary"
                    disabled={disabled || !availablePrice || status?.plan === plan}
                    onClick={() => void action(current ? 'portal' : 'checkout', plan)}
                  >
                    {status?.plan === plan
                      ? 'Tu plan'
                      : current
                        ? `Cambiar a ${PLANS[plan].name}`
                        : `Elegir ${PLANS[plan].name}`}
                  </button>
                )}
              </article>
            );
          })}
        </div>
        <p className="privacy-caption">
          Las solicitudes de IA se reinician el primer día de cada mes (UTC); cada envío al
          proveedor cuenta, incluso si falla. La transcripción usa las credenciales de Glu y los
          minutos incluidos en tu plan. El total y los impuestos aplicables se muestran en Stripe
          antes de pagar.
        </p>
        {status?.limit ? (
          <p className="muted">
            Próximo reinicio de uso: {new Date(status.resetsAt).toLocaleString('es-CL')}
          </p>
        ) : null}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        {link && (
          <button
            className="primary billing-stripe"
            onClick={() => void openStripe(link).catch((e) => setError(errorText(e)))}
          >
            Abrir Stripe <ExternalLink size={15} />
          </button>
        )}
        {confirmCancel && (
          <div className="billing-confirm">
            <strong>¿Cancelar la renovación?</strong>
            <p>
              Conservarás las funciones pagadas hasta {end || 'el final del período vigente'}.
              Después volverás al plan Gratis y conservarás tus reuniones.
            </p>
            <button disabled={disabled} onClick={() => setConfirmCancel(false)}>
              Mantener suscripción
            </button>
            <button className="danger" disabled={disabled} onClick={() => void action('cancel')}>
              Confirmar cancelación
            </button>
          </div>
        )}
        {recording && (
          <p className="notice">Finaliza la reunión activa antes de gestionar pagos.</p>
        )}
        <footer>
          <button disabled={busy || b.loading} onClick={() => void b.refresh()}>
            <RefreshCw size={14} /> Actualizar estado
          </button>
          {status?.canManage && (
            <button disabled={disabled} onClick={() => void action('portal')}>
              Gestionar pagos
            </button>
          )}
          {current && ['active', 'trialing', 'past_due'].includes(current.status) && (
            <button
              disabled={disabled}
              onClick={() =>
                current.cancel_at_period_end ? void action('resume') : setConfirmCancel(true)
              }
            >
              {current.cancel_at_period_end ? 'Reactivar renovación' : 'Cancelar suscripción'}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
