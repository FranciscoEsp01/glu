import { test, expect } from '@playwright/test';
import { mockAuth, session, accountId } from './auth-fixture';

test('Login validates email code, hides history, and closes the session', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bienvenido a Glu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva reunión' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/glu-login.png', fullPage: true });
  await page.getByLabel('Correo electrónico').fill('ana@example.com');
  await page.getByRole('button', { name: 'Continuar con correo' }).click();
  await page.getByLabel('Código de verificación').fill('000000');
  await page.getByRole('button', { name: 'Entrar a Glu' }).click();
  await expect(page.getByRole('alert')).toContainText('incorrecto o ha vencido');
  await expect(page.getByRole('button', { name: 'Nueva reunión' })).toHaveCount(0);
  await page.getByLabel('Código de verificación').fill('123456');
  await page.getByRole('button', { name: 'Entrar a Glu' }).click();
  await expect(page.getByText('ana@example.com', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenido a Glu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva reunión' })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('glu-auth-session'))).toBeNull();
});

test('Switching accounts keeps histories separate and does not claim legacy history', async ({
  page,
}) => {
  await mockAuth(page, true);
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem('glu_meetings_data_v1', 'legacy-history-preserved'),
  );
  await page.getByLabel('Transcripción para importar').fill('Reunión privada de Ana');
  await page.getByRole('button', { name: 'Guardar transcripción' }).click();
  await expect(page.locator('.transcript-lines')).toContainText('Reunión privada de Ana');
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByLabel('Correo electrónico').fill('bea@example.com');
  await page.getByRole('button', { name: 'Continuar con correo' }).click();
  await page.getByLabel('Código de verificación').fill('123456');
  await page.getByRole('button', { name: 'Entrar a Glu' }).click();
  await expect(page.getByText('bea@example.com', { exact: true })).toBeVisible();
  await expect(page.getByText('Las buenas ideas')).toBeVisible();
  await expect(page.getByText('Reunión privada de Ana')).toHaveCount(0);
  const history = await page.evaluate(
    (id) => localStorage.getItem(`glu_meetings_data_v1:${id}`),
    accountId,
  );
  expect(history).toContain('Reunión privada de Ana');
  expect(await page.evaluate(() => localStorage.getItem('glu_meetings_data_v1'))).toBe(
    'legacy-history-preserved',
  );
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.getByLabel('Correo electrónico').fill('ana@example.com');
  await page.getByRole('button', { name: 'Continuar con correo' }).click();
  await page.getByLabel('Código de verificación').fill('123456');
  await page.getByRole('button', { name: 'Entrar a Glu' }).click();
  await expect(page.locator('.transcript-lines')).toContainText('Reunión privada de Ana');
});

test('A forged persisted session cannot open the workspace when the server rejects it', async ({
  page,
}) => {
  await mockAuth(page, true);
  await page.route('https://glu-test.supabase.co/auth/v1/user', (route) =>
    route.fulfill({ status: 401, json: { code: 'bad_jwt', message: 'Invalid JWT' } }),
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva reunión' })).toHaveCount(0);
});

test('Auth network failure is recoverable and never displays local meetings', async ({ page }) => {
  await page.addInitScript(
    (value) => sessionStorage.setItem('glu-auth-session', JSON.stringify(value)),
    session(),
  );
  await page.route('https://glu-test.supabase.co/**', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva reunión' })).toHaveCount(0);
});

test('Expired access hides the workspace and disables global shortcuts', async ({ page }) => {
  await mockAuth(page, true);
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Nueva reunión' })).toBeVisible();
  await page.clock.fastForward(3_601_000);
  await expect(page.getByRole('alertdialog', { name: 'Sesión finalizada' })).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.getByPlaceholder('Buscar reuniones, tareas, comandos...')).toHaveCount(0);
});
