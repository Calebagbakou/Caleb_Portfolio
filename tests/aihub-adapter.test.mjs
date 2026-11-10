import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAiHubAdapter } from '../supabase/functions/_shared/providers/aihubAdapter.ts';

const target = {
  key: 'coursera_premium_12m',
  productId: '17',
  providerProductIds: { aihub: '17' },
  configuredProvider: 'aihub',
  shopProductId: 'shop-product-1',
  name: 'Coursera Premium 12 months',
  quantity: 1,
};

function makeAdapter() {
  return createAiHubAdapter({
    getApiKey: () => 'sapi-test-secret',
    getProductId: () => target.productId,
    isConfigured: () => true,
  });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function withMockedFetch(mock, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('AiHUB catalog normalizes IDs, USD prices, stock, and required customer input', async () => {
  await withMockedFetch(async (url, init) => {
    assert.equal(String(url), 'https://api.aihub.fashion/v1/products');
    assert.equal(init.headers['X-API-Key'], 'sapi-test-secret');
    return jsonResponse([{
      id: 17,
      name_en: 'Premium subscription',
      description_en: 'One year',
      stock: 5,
      price_usd: 4.75,
      input_required: 'email',
    }]);
  }, async () => {
    const result = await makeAdapter().listProducts();
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      products: [{
        id: '17',
        name: 'Premium subscription',
        description: 'One year',
        stock: 5,
        price: 4.75,
        currency: 'USD',
        inStock: true,
        inputRequired: 'email',
        requiresEmailActivation: true,
        name_en: 'Premium subscription',
        description_en: 'One year',
        price_usd: 4.75,
        input_required: 'email',
      }],
    });
  });
});

test('AiHUB checks catalog stock and USD wallet balance', async () => {
  await withMockedFetch(async (url, init) => {
    assert.equal(init.headers['X-API-Key'], 'sapi-test-secret');
    if (String(url).endsWith('/products/17')) {
      return jsonResponse({ id: 17, stock: 3, price_usd: 4.75 });
    }
    return jsonResponse({ balance: 10, currency: 'USD' });
  }, async () => {
    assert.deepEqual(await makeAdapter().checkAvailability(target), {
      available: true,
      stock: 3,
      balanceOk: true,
      price: 4.75,
      currency: 'USD',
    });
  });
});

test('AiHUB purchase uses a stable idempotency key and returns text keys and activation URLs', async () => {
  const idempotencyKeys = [];
  await withMockedFetch(async (url, init) => {
    assert.equal(String(url), 'https://api.aihub.fashion/v1/buy');
    assert.deepEqual(JSON.parse(init.body), { product_id: 17, quantity: 1 });
    idempotencyKeys.push(init.headers['Idempotency-Key']);
    return jsonResponse({
      order: {
        id: 'AH-123',
        status: 'delivered',
        items: [{ type: 'text', content: 'ACCESS-CODE' }],
        activation_url: 'https://redeem.example/activate',
      },
    });
  }, async () => {
    const adapter = makeAdapter();
    const context = {
      orderId: 'shop-order-123',
      customer: null,
      attempt: 1,
      product: { id: '17', inputRequired: null },
      previousState: { status: 'not_started', attempt: 1 },
    };
    const first = await adapter.createOrder(target, 'caleb-target-order-1', context);
    const second = await adapter.createOrder(target, 'caleb-target-order-1', context);
    assert.equal(first.status, 'success');
    assert.equal(first.orderId, 'AH-123');
    assert.deepEqual(adapter.normalize(first).accessKeys, ['ACCESS-CODE', 'https://redeem.example/activate']);
    assert.equal(second.status, 'success');
  });
  assert.equal(idempotencyKeys[0].length <= 64, true);
  assert.equal(idempotencyKeys[0], idempotencyKeys[1]);
  assert.notEqual(idempotencyKeys[0], 'caleb-target-order-1');
});

test('AiHUB-required customer input is rejected before any purchase request', async () => {
  await withMockedFetch(async () => {
    assert.fail('AiHUB purchase should not be called without customer input support.');
  }, async () => {
    const state = await makeAdapter().createOrder(target, 'key', {
      orderId: 'shop-order-1',
      customer: { email: 'buyer@example.com' },
      attempt: 1,
      product: { id: '17', inputRequired: 'orgid' },
      previousState: { status: 'not_started', attempt: 1 },
    });
    assert.equal(state.status, 'failed');
    assert.match(state.error, /Aucun achat n’a été lancé/);
  });
});

test('AiHUB file items are not exposed as web access keys', async () => {
  await withMockedFetch(async () => jsonResponse({
    order: {
      id: 'AH-456',
      status: 'delivered',
      items: [{ type: 'file', note_en: 'delivered via Telegram' }],
    },
  }), async () => {
    const state = await makeAdapter().createOrder(target, 'key', {
      orderId: 'shop-order-2',
      customer: null,
      attempt: 1,
      product: { id: '17', inputRequired: null },
      previousState: { status: 'not_started', attempt: 1 },
    });
    assert.equal(state.status, 'success');
    assert.deepEqual(makeAdapter().normalize(state).accessKeys, []);
    assert.match(state.error, /Telegram/);
  });
});
