import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const migration = await readFile(
  new URL('../supabase/migrations/029_shop_activation_provider_settings.sql', import.meta.url),
  'utf8',
);
const zfourstoreMigration = await readFile(
  new URL('../supabase/migrations/031_shop_zfourstore_provider.sql', import.meta.url),
  'utf8',
);
const productMappingMigration = await readFile(
  new URL('../supabase/migrations/032_shop_product_api_mappings.sql', import.meta.url),
  'utf8',
);

test('provider settings, runtime state, alerts, and history are protected by admin RLS', () => {
  for (const table of [
    'shop_provider_settings',
    'shop_provider_switch_log',
    'shop_provider_runtime',
    'shop_provider_events',
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(migration, new RegExp(`on public\\.${table}[^;]*using \\(public\\.is_admin\\(\\)\\)`, 'is'));
  }
  assert.match(migration, /revoke all on public\.shop_provider_settings from anon, authenticated/i);
  assert.match(migration, /revoke all on public\.shop_provider_runtime from anon, authenticated/i);
  assert.match(migration, /grant select on public\.shop_provider_runtime to authenticated/i);
});

test('provider changes require an admin and a server-configured provider', () => {
  assert.match(migration, /security definer/i);
  assert.match(migration, /if not public\.is_admin\(\) then/i);
  assert.match(migration, /where provider = p_provider and is_configured/i);
  assert.match(migration, /revoke all on function public\.set_shop_provider\(text, text, text\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.set_shop_provider\(text, text, text\) to authenticated/i);
});

test('Z FOUR STORE replaces PixVerify for the global API setting and protects purchase claims', () => {
  assert.match(zfourstoreMigration, /check \(target_key = 'all_api'\)/i);
  assert.match(zfourstoreMigration, /check \(active_provider in \('prodseller', 'zfourstore'\)\)/i);
  assert.match(zfourstoreMigration, /where active_provider = 'pixverify'[\s\S]*?'prodseller'/i);
  assert.match(zfourstoreMigration, /shop_provider_order_claims enable row level security/i);
  assert.match(zfourstoreMigration, /function public\.claim_shop_provider_order/i);
  assert.match(zfourstoreMigration, /where shop_provider_order_claims\.status = 'released'/i);
  assert.match(zfourstoreMigration, /grant execute on function public\.claim_shop_provider_order\(uuid, text\) to service_role/i);
  assert.match(zfourstoreMigration, /if not public\.is_admin\(\) then/i);
  assert.match(zfourstoreMigration, /p_provider not in \('prodseller', 'zfourstore'\)/i);
  assert.match(zfourstoreMigration, /where provider = p_provider and is_configured/i);
});

test('product mappings allow provider switching only for configured products', () => {
  assert.match(productMappingMigration, /add column if not exists prodseller_product_id text/i);
  assert.match(productMappingMigration, /add column if not exists zfourstore_product_id text/i);
  assert.match(productMappingMigration, /active_api_provider in \('prodseller', 'zfourstore'\)/i);
  assert.match(productMappingMigration, /function public\.set_shop_product_provider/i);
  assert.match(productMappingMigration, /if not public\.is_admin\(\) then/i);
  assert.match(productMappingMigration, /where provider = p_provider and is_configured/i);
  assert.match(productMappingMigration, /nullif\(trim\(prodseller_product_id\), ''\)/i);
  assert.match(productMappingMigration, /nullif\(trim\(zfourstore_product_id\), ''\)/i);
  assert.match(productMappingMigration, /grant execute on function public\.set_shop_product_provider\(uuid, text, text\) to authenticated/i);
});
