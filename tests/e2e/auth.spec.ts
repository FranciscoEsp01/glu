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

test('Email provider errors explain the cause without leaking raw server messages', async ({
  page,
}) => {
  await mockAuth(page);
  await page.route('https://glu-test.supabase.co/auth/v1/otp', (route) =>
    route.fulfill({
      status: 403,
      headers: {
        'x-supabase-api-version': '2024-01-01',
        'access-control-expose-headers': 'x-supabase-api-version',
      },
      json: { code: 'email_address_not_authorized', msg: 'private-server-detail' },
    }),
  );
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill('ana@example.com');
  await page.getByRole('button', { name: 'Continuar con correo' }).click();
  await expect(page.getByRole('alert')).toContainText('configurar el envío de correos');
  await expect(page.getByRole('alert')).not.toContainText('private-server-detail');
});

test('Google uses PKCE and validates the callback before opening the workspace', async ({
  page,
}) => {
  await mockAuth(page);
  await page.route('https://glu-test.supabase.co/auth/v1/settings', (route) =>
    route.fulfill({ json: { external: { google: true } } }),
  );
  await page.route('https://glu-test.supabase.co/auth/v1/authorize**', async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('code_challenge_method')).toBe('s256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    const callback = new URL(url.searchParams.get('redirect_to')!);
    expect(callback.searchParams.get('glu_oauth_state')).toBeTruthy();
    callback.searchParams.set('code', 'test-auth-code');
    await route.fulfill({ status: 302, headers: { location: callback.href } });
  });
  let exchanged = false;
  await page.route('https://glu-test.supabase.co/auth/v1/token**', (route) => {
    const body = route.request().postDataJSON();
    expect(body.auth_code).toBe('test-auth-code');
    expect(body.code_verifier.length).toBeGreaterThan(30);
    exchanged = true;
    return route.fulfill({ json: session() });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar con Google' }).click();
  await expect(page.getByRole('button', { name: 'Nueva reunión' })).toBeVisible();
  expect(exchanged).toBe(true);
  expect(new URL(page.url()).search).toBe('');
});

test('Unsolicited Google callbacks cannot exchange a code or open a session', async ({ page }) => {
  await mockAuth(page);
  let exchanged = false;
  await page.route('https://glu-test.supabase.co/auth/v1/token**', (route) => {
    exchanged = true;
    return route.fulfill({ json: session() });
  });
  await page.goto('/?glu_oauth_state=unsolicited&code=attacker-code');
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
  expect(exchanged).toBe(false);
  await expect(page.getByRole('button', { name: 'Nueva reunión' })).toHaveCount(0);
  expect(new URL(page.url()).search).toBe('');
});

test('Google configuration is checked before sending the user to the browser', async ({ page }) => {
  await mockAuth(page);
  await page.route('https://glu-test.supabase.co/auth/v1/settings', (route) =>
    route.fulfill({ json: { external: { google: false } } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar con Google' }).click();
  await expect(page.getByRole('alert')).toContainText('Google aún no está activado');
  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeEnabled();
});

test('Desktop Google keeps PKCE separate from the Keychain session and exchanges the native callback', async ({ page }) => {
  await mockAuth(page);
  await page.route('https://glu-test.supabase.co/auth/v1/settings', route => route.fulfill({ json: { external: { google: true } } }));
  await page.route('https://glu-test.supabase.co/auth/v1/token**', route => {
    expect(route.request().postDataJSON().code_verifier.length).toBeGreaterThan(30);
    return route.fulfill({ json: session() });
  });
  await page.addInitScript(() => {
    (window as any).__TAURI__ = {
      core: {
        invoke: async (command: string, args: any) => {
          if (command === 'auth_session_get') return sessionStorage.getItem('test-native-session');
          if (command === 'auth_session_set') {
            if (args.value) {
              const parsed = JSON.parse(args.value);
              if (!parsed.access_token) throw Error('PKCE must not overwrite the Keychain session');
              sessionStorage.setItem('test-native-session', args.value);
            } else sessionStorage.removeItem('test-native-session');
            return null;
          }
          if (command === 'auth_oauth_sign_in') {
            if ('account' in args) throw Error('OAuth must work before an account is known');
            const url = new URL(args.url);
            const callback = new URL(url.searchParams.get('redirect_to')!);
            if (callback.origin !== 'http://127.0.0.1:42813' || callback.searchParams.get('glu_oauth_state') !== args.state)
              throw Error('Incorrect native callback');
            if (sessionStorage.getItem('test-native-session')) throw Error('Premature session');
            callback.searchParams.set('code', 'native-code');
            return callback.href;
          }
          return null;
        },
      },
      event: { listen: async () => () => {} },
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar con Google' }).click();
  await expect(page.getByRole('button', { name: 'Nueva reunión' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('test-native-session')!).user.email)).toBe('ana@example.com');
});
