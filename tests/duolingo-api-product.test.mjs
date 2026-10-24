import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  getProdSellerProductKey,
  getProdSellerTargetKey,
} from '../supabase/functions/_shared/delivery.ts';

const migration = await readFile(
  new URL('../supabase/migrations/030_duolingo_super_api_product.sql', import.meta.url),
  'utf8',
);

test('Duolingo Super API delivery maps only the 12-month plan', () => {
  const product = { slug: 'duolingo-super', delivery_type: 'api' };
  assert.equal(getProdSellerProductKey(product), 'duolingo_super_12m');
  assert.equal(getProdSellerTargetKey(product, '12mois'), 'duolingo_super_12m');
  assert.equal(getProdSellerTargetKey(product, '6mois'), null);
  assert.equal(getProdSellerTargetKey({ ...product, delivery_type: 'activate' }, '12mois'), null);
});

test('generic API products use their shop product ID as a provider target', () => {
  const product = {
    id: '6a9342e2-4477-47c1-9c37-6f1d22e79f3b',
    slug: 'new-service',
    delivery_type: 'api',
  };
  assert.equal(getProdSellerTargetKey(product), product.id);
  assert.equal(getProdSellerTargetKey(product, 'monthly'), product.id);
  assert.equal(getProdSellerTargetKey({ ...product, delivery_type: 'download' }), null);
});

test('Duolingo Super migration seeds the API product and its 12-month price idempotently', () => {
  assert.match(migration, /'duolingo-super'/);
  assert.match(migration, /'Duolingo Super'/);
  assert.match(migration, /'api'/);
  assert.match(migration, /'12mois',\s*'12 mois',\s*1000,\s*null,\s*'XOF'/);
  assert.match(migration, /where not exists[\s\S]*?plan\.slug = '12mois'/i);
});
