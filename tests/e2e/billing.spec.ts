import { test, expect } from './auth-fixture';
import { billingState, mockBilling } from './billing-fixture';

test('Free user sees server prices and can prepare a Stripe checkout without granting access', async ({
  page,
}) => {
  const state = billingState('free');
  state.paymentMode = 'test';
  const calls = await mockBilling(page, state);
  await page.goto('/');
  await page.getByRole('button', { name: /Plan y facturación/ }).click();
  await expect(page.getByText('Plan actual: Gratis')).toBeVisible();
  await expect(
    page.getByText(
      'Stripe está en modo de pruebas. Los pagos de este entorno no cobran dinero real.',
    ),
  ).toBeVisible();
  await expect(page.locator('.billing-price').filter({ hasText: '15,00 USD' })).toBeVisible();
  await expect(page.locator('.billing-price').filter({ hasText: '25,00 USD' })).toBeVisible();
  await page.screenshot({ path: 'test-results/glu-billing.png', fullPage: true });
  await page.getByRole('button', { name: 'Elegir Pro', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir Stripe', exact: true })).toBeVisible();
  expect(calls.filter((c) => c.action === 'checkout')).toEqual([
    { action: 'checkout', plan: 'pro' },
  ]);
  await expect(page.getByText('Plan actual: Gratis')).toBeVisible();
});

test('Cancellation requires confirmation and retains current paid plan; resumption is available', async ({
  page,
}) => {
  const state = billingState('pro');
  const calls = await mockBilling(page, state);
  await page.goto('/');
  await page.getByRole('button', { name: /Plan y facturación/ }).click();
  await page.getByRole('button', { name: 'Cancelar suscripción', exact: true }).click();
  expect(calls.some((c) => c.action === 'cancel')).toBe(false);
  await page.getByRole('button', { name: 'Confirmar cancelación', exact: true }).click();
  await expect(page.getByText('Plan actual: Pro')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Reactivar renovación', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reactivar renovación', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Cancelar suscripción', exact: true }),
  ).toBeVisible();
  expect(calls.filter((c) => c.action === 'cancel').length).toBe(1);
});

test('Failed payment shows recovery action; server-denied AI preserves the transcript', async ({
  page,
}) => {
  await mockBilling(page, billingState('pro', 'past_due'));
  await page.goto('/');
  await page
    .getByLabel('Transcripción para importar')
    .fill('Acuerdo importante que debe conservarse.');
  await page.getByRole('button', { name: 'Guardar transcripción' }).click();
  await page.getByRole('button', { name: 'Generar resumen', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Plan y facturación' })).toBeVisible();
  await expect(page.getByText(/Hay un pago pendiente/)).toBeVisible();
  await page.getByRole('button', { name: 'Gestionar pagos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir Stripe', exact: true })).toBeVisible();
  await page.getByLabel('Cerrar facturación').click();
  await expect(page.locator('.transcript-lines')).toContainText('Acuerdo importante');
});

test('Billing outage does not claim a paid plan or hide the local history', async ({ page }) => {
  await page.route('https://glu-test.supabase.co/functions/v1/billing', (route) =>
    route.fulfill({ status: 503, json: { error: 'Servicio temporalmente no disponible.' } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Plan y facturación/ }).click();
  await expect(page.getByRole('alert')).toContainText('Servicio temporalmente no disponible');
  await expect(page.getByRole('button', { name: 'Elegir Pro', exact: true })).toBeDisabled();
  await page.getByLabel('Cerrar facturación').click();
  await expect(page.getByLabel('Transcripción para importar')).toBeVisible();
});

test('Account consumption displays measured tokens and transcription minutes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Plan y facturación/ }).click();
  await expect(page.getByRole('dialog', { name: 'Plan y facturación' })).toContainText(
    '2 de 1500 minutos de transcripción',
  );
  await expect(page.getByRole('dialog', { name: 'Plan y facturación' })).toContainText(
    'tokens de IA este mes',
  );
});
