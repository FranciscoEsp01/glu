import test from 'node:test';
import assert from 'node:assert/strict';
import { supabaseProjectUrl } from '../src/services/supabase-config';

test('Copied REST URL resolves auth and billing against the project origin', () => {
  for (const suffix of ['', '/', '/rest/v1', '/rest/v1/']) {
    const base = supabaseProjectUrl(` https://project.supabase.co${suffix} `);
    assert.equal(`${base}/auth/v1/otp`, 'https://project.supabase.co/auth/v1/otp');
    assert.equal(`${base}/functions/v1/billing`, 'https://project.supabase.co/functions/v1/billing');
  }
});
test('Invalid or ambiguous Supabase configuration is rejected', () => {
  for (const value of [undefined, '', 'invalid', 'http://project.supabase.co',
    'https://user:password@project.supabase.co', 'https://project.supabase.co?key=secret',
    'https://project.supabase.co#fragment', 'https://project.supabase.co/arbitrary'])
    assert.equal(supabaseProjectUrl(value), null);
});
