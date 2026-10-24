import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  resolvePinnedProvider,
  resolveProvider,
  shouldCreateProviderOrder,
} from '../supabase/functions/_shared/providers/providerRouting.mjs';

test('the global provider setting routes every API product and defaults invalid settings to ProdSeller', () => {
  assert.equal(resolveProvider('gemini_18m', 'zfourstore'), 'zfourstore');
  assert.equal(resolveProvider('canva_pro', 'zfourstore'), 'zfourstore');
  assert.equal(resolveProvider('duolingo_super_12m', 'zfourstore'), 'zfourstore');
  assert.equal(resolveProvider('gemini_18m', null), 'prodseller');
  assert.equal(resolveProvider('gemini_18m', 'pixverify'), 'prodseller');
  assert.equal(resolveProvider('gemini_18m', 'unknown'), 'prodseller');
});

test('provider pinning preserves the supplier already assigned to an activation', () => {
  assert.equal(
    resolvePinnedProvider('gemini_18m', { provider: 'prodseller' }, 'zfourstore'),
    'prodseller',
  );
  assert.equal(
    resolvePinnedProvider('gemini_18m', { provider: 'zfourstore' }, 'prodseller'),
    'zfourstore',
  );
  assert.equal(
    resolvePinnedProvider('gemini_18m', { orderId: 'existing-order' }, 'zfourstore'),
    'prodseller',
  );
  assert.equal(
    resolvePinnedProvider('gemini_18m', null, 'zfourstore', true),
    'zfourstore',
  );
  assert.equal(
    resolvePinnedProvider('canva_pro', { provider: 'zfourstore' }, 'prodseller', true),
    'zfourstore',
  );
  assert.equal(
    resolvePinnedProvider('gemini_18m', { status: 'not_started' }, 'zfourstore'),
    'prodseller',
  );
  assert.equal(resolvePinnedProvider('gemini_18m', null, 'zfourstore'), 'prodseller');
});

test('an item with an existing provider order can never create a second order', () => {
  const existing = { status: 'starting', provider: 'zfourstore', orderId: 'provider-order-1' };
  assert.equal(shouldCreateProviderOrder(existing, 'deliver'), false);
  assert.equal(shouldCreateProviderOrder(existing, 'retry'), false);
  assert.equal(shouldCreateProviderOrder(existing, 'status'), false);
  assert.equal(shouldCreateProviderOrder({ status: 'failed', provider: 'zfourstore' }, 'retry'), false);
  assert.equal(shouldCreateProviderOrder({ status: 'not_started' }, 'deliver'), true);
  assert.equal(shouldCreateProviderOrder({ status: 'not_started' }, 'retry'), false);
  assert.equal(shouldCreateProviderOrder({ status: 'not_started' }, 'retry', true), true);
  assert.equal(shouldCreateProviderOrder({ status: 'retryable' }, 'retry'), true);
  assert.equal(shouldCreateProviderOrder({ status: 'retryable' }, 'deliver'), false);
  assert.equal(shouldCreateProviderOrder(undefined, 'status', true), false);
});
