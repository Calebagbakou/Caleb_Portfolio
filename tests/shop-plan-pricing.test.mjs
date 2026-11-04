import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { findPlan, getDefaultPlan } from '../src/data/products.js';

const migration = await readFile(
  new URL('../supabase/migrations/033_shop_plan_pricing_and_providers.sql', import.meta.url),
  'utf8',
);
const shopService = await readFile(
  new URL('../src/services/shop.js', import.meta.url),
  'utf8',
);

test('the default formula is the cheapest active formula with a valid price', () => {
  const product = {
    plans: [
      { id: 'inactive', price: 500, active: false },
      { id: 'high', price: 1500, active: true },
      { id: 'low', price: 1000, active: true },
      { id: 'invalid', price: 0, active: true },
    ],
  };
  assert.equal(getDefaultPlan(product).id, 'low');
});

test('a stale cart formula ID cannot silently fall back to another formula', () => {
  const product = { plans: [{ id: 'four-months' }, { id: 'twelve-months' }] };
  assert.equal(findPlan(product, 'twelve-months').id, 'twelve-months');
  assert.equal(findPlan(product, 'removed-formula'), null);
});

test('formula prices and API supplier IDs are stored on each plan', () => {
  assert.match(migration, /add column if not exists active_api_provider text/i);
  assert.match(migration, /add column if not exists provider_product_id text/i);
  assert.match(migration, /update public\.product_plans as plan[\s\S]*?provider_product_id/i);
  assert.match(migration, /update public\.products[\s\S]*?regular_price = null[\s\S]*?promo_price = null/i);
  assert.match(shopService, /price: Number\(plan\.price\)/);
  assert.match(shopService, /provider_product_id: plan\.provider_product_id/);
});
