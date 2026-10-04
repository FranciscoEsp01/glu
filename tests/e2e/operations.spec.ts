import { test, expect } from './auth-fixture';
test('Operator panel displays usage without meeting content and acknowledges alerts', async ({
  page,
}) => {
  await page.route('https://glu-test.supabase.co/rest/v1/operator_accounts**', (route) =>
    route.fulfill({ json: [{ user_id: '11111111-1111-4111-8111-111111111111' }] }),
  );
  let acknowledged = false;
  await page.route('https://glu-test.supabase.co/functions/v1/operations-admin', (route) => {
    const body = route.request().postDataJSON();
    if (body.action === 'acknowledge') {
      acknowledged = true;
      return route.fulfill({ json: { acknowledged: true } });
    }
    return route.fulfill({
      json: {
        generatedAt: new Date().toISOString(),
        alerts: [
          {
            key: 'interrupted_operations',
            severity: 'warning',
            message: '1 operación pendiente.',
            acknowledged_until: acknowledged ? new Date(Date.now() + 1800000).toISOString() : null,
          },
        ],
        accounts: [
          {
            user_id: '11111111-1111-4111-8111-111111111111',
            plan: 'pro',
            tokens: 1200,
            audio_seconds: 120,
            requests: 1,
            estimatedCostUSD: null,
            unmeasured: 1,
          },
        ],
        requests: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            user_id: '11111111-1111-4111-8111-111111111111',
            feature: 'summary',
            status: 'pending',
            created_at: new Date().toISOString(),
            provider_status: null,
          },
        ],
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Operaciones y consumo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Operaciones de Glu' });
  await expect(dialog.getByText('Tarifas no configuradas')).toBeVisible();
  await dialog.getByRole('button', { name: 'Marcar revisado por 30 minutos' }).click();
  await expect(dialog.getByText(/Revisado hasta/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar operaciones' }).click();
  await expect(dialog).not.toBeVisible();
});
test('Regular account does not see operator tools', async ({ page }) => {
  await page.route('https://glu-test.supabase.co/rest/v1/operator_accounts**', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Nueva reunión' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Operaciones y consumo' })).toHaveCount(0);
});
