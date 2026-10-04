import { test } from 'node:test';
import assert from 'node:assert/strict';
import { healthHandler } from '../supabase/functions/_shared/health';
test('Readiness distinguishes incomplete setup and database failures without leaking errors', async () => {
  const request = new Request('https://edge.example/health');
  const configured = { billing: true, summary: true, transcription: true };
  assert.equal(
    (await healthHandler({ checkDatabase: async () => true, configured })(request)).status,
    200,
  );
  assert.equal(
    (
      await healthHandler({
        checkDatabase: async () => true,
        configured: { ...configured, billing: false },
      })(request)
    ).status,
    503,
  );
  const failed = await healthHandler({
    checkDatabase: async () => {
      throw new Error('secret');
    },
    configured,
  })(request);
  assert.equal(failed.status, 503);
  assert.ok(!(await failed.text()).includes('secret'));
  assert.equal(
    (
      await healthHandler({ checkDatabase: async () => true, configured })(
        new Request(request.url, { method: 'POST' }),
      )
    ).status,
    405,
  );
});
