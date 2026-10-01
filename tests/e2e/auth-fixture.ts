import { mockBilling } from './billing-fixture';
import { test as base, expect, type Page } from '@playwright/test';
export const accountId = '11111111-1111-4111-8111-111111111111';
export function session(id = accountId, email = 'ana@example.com') {
  const now = Math.floor(Date.now() / 1000);
  const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: now + 3600, iat: now, role: 'authenticated' })).toString('base64url')}.test`;
  return {
    access_token: jwt,
    refresh_token: 'test-refresh',
    expires_at: now + 3600,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id,
      email,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}
export async function mockAuth(page: Page, signedIn = false) {
  const initial = session();
  await mockBilling(page);
  await page.route('https://glu-test.supabase.co/functions/v1/paid-ai', (route) =>
    route.fulfill({ status: 503, json: { error: 'El servicio de IA no está disponible.' } }),
  );
  await page.route('https://glu-test.supabase.co/auth/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/user')) {
      const token = route.request().headers().authorization?.split(' ')[1];
      let id = accountId;
      try {
        id = JSON.parse(Buffer.from(token!.split('.')[1], 'base64url').toString()).sub;
      } catch {
        /* Invalid token fixture. */
      }
      return route.fulfill({
        json: session(id, id === accountId ? 'ana@example.com' : 'bea@example.com').user,
      });
    }
    if (path.endsWith('/otp')) return route.fulfill({ json: {} });
    if (path.endsWith('/verify')) {
      const body = route.request().postDataJSON();
      if (body.token !== '123456')
        return route.fulfill({
          status: 403,
          headers: {
            'x-supabase-api-version': '2024-01-01',
            'access-control-expose-headers': 'x-supabase-api-version',
          },
          json: { code: 'otp_expired', msg: 'Token expired' },
        });
      return route.fulfill({
        json: session(
          body.email === 'ana@example.com' ? accountId : '22222222-2222-4222-8222-222222222222',
          body.email,
        ),
      });
    }
    if (path.endsWith('/logout')) return route.fulfill({ status: 204 });
    return route.fulfill({ status: 400, json: { message: 'Unexpected auth request' } });
  });
  if (signedIn)
    await page.addInitScript((initial) => {
      if (!sessionStorage.getItem('test-session-seeded')) {
        sessionStorage.setItem('glu-auth-session', JSON.stringify(initial));
        sessionStorage.setItem('test-session-seeded', 'true');
      }
    }, initial);
}
export const test = base.extend({
  page: async ({ page }, use) => {
    await mockAuth(page, true);
    await use(page);
  },
});
export { expect };
