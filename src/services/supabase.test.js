import test from 'node:test';
import assert from 'node:assert/strict';

test('supabase client falls back gracefully when env config is missing', async () => {
  const mod = await import('./supabase.js');
  assert.ok(mod.supabase);
  assert.ok(mod.supabase.auth);
  assert.equal(typeof mod.supabase.from, 'function');
});
