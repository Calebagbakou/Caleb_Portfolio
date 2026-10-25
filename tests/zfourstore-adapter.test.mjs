import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createZFourStoreAdapter } from '../supabase/functions/_shared/providers/zfourstoreAdapter.ts';

const target = {
  key: 'duolingo_super_12m',
  productId: 'supplier-product-id',
  shopProductId: 'shop-product-id',
  name: 'Duolingo Super 12 mois',
  quantity: 1,
};

function makeAdapter() {
  return createZFourStoreAdapter({
    getApiKey: () => 'zfour-test-key',
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

test('Z FOUR STORE reads product availability and wallet balance with its secret header', async () => {
  const calls = [];
  await withMockedFetch(async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/products')) {
      return jsonResponse({ success: true, data: [{ id: target.productId, stock: 3, price: 1.5 }] });
    }
    return jsonResponse({ success: true, data: { balance: 4.5 } });
  }, async () => {
    assert.deepEqual(await makeAdapter().checkAvailability(target), {
      available: true,
      stock: 3,
      balanceOk: true,
    });
  });
  assert.deepEqual(calls.map(({ url }) => url).sort(), [
    'https://zfourstore.up.railway.app/api/v1/balance',
    'https://zfourstore.up.railway.app/api/v1/products',
  ]);
  assert.equal(calls.every(({ init }) => init.headers['X-API-Key'] === 'zfour-test-key'), true);
});

test('Z FOUR STORE lists catalog IDs and supplier details without exposing its API key', async () => {
  const calls = [];
  await withMockedFetch(async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({
      success: true,
      data: [{
        id: 'catalog-product-1',
        name: 'Duolingo Super',
        description: '12 mois',
        price: 3.5,
        stock: 8,
      }],
    });
  }, async () => {
    const result = await makeAdapter().listProducts();
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      products: [{
        id: 'catalog-product-1',
        name: 'Duolingo Super',
        description: '12 mois',
        price: 3.5,
        stock: 8,
        inStock: true,
      }],
    });
  });
  assert.equal(calls[0].url, 'https://zfourstore.up.railway.app/api/v1/products');
  assert.equal(calls[0].init.headers['X-API-Key'], 'zfour-test-key');
});

test('Z FOUR STORE creates an order and normalizes delivered access links', async () => {
  await withMockedFetch(async (url, init) => {
    assert.equal(String(url), 'https://zfourstore.up.railway.app/api/v1/order');
    assert.deepEqual(JSON.parse(init.body), { productId: target.productId, quantity: 1 });
    return jsonResponse({
      success: true,
      data: { orderId: 'supplier-order-1', items: ['https://access.example/item-1'] },
    }, 201);
  }, async () => {
    const state = await makeAdapter().createOrder(target, 'unused-idempotency-key', {
      orderId: 'shop-order-1',
      customer: null,
      attempt: 1,
      previousState: { status: 'not_started', attempt: 1 },
    });
    assert.equal(state.status, 'success');
    assert.equal(state.orderId, 'supplier-order-1');
    assert.deepEqual(makeAdapter().normalize(state), {
      status: 'success',
      links: [],
      accessKeys: ['https://access.example/item-1'],
    });
  });
});

test('an uncertain Z FOUR STORE create response is terminal and cannot be retried automatically', async () => {
  await withMockedFetch(async () => {
    throw new Error('connection timed out');
  }, async () => {
    const state = await makeAdapter().createOrder(target, 'unused-idempotency-key', {
      orderId: 'shop-order-1',
      customer: null,
      attempt: 1,
      previousState: { status: 'not_started', attempt: 1 },
    });
    assert.equal(state.status, 'failed');
    assert.match(state.error, /Aucun nouvel achat automatique/);
  });
});

test('a successful response without an order reference is not safe to retry', async () => {
  await withMockedFetch(async () => jsonResponse({
    success: true,
    data: { productId: target.productId, quantity: 1, items: [] },
  }, 201), async () => {
    const state = await makeAdapter().createOrder(target, 'unused-idempotency-key', {
      orderId: 'shop-order-1',
      customer: null,
      attempt: 1,
      previousState: { status: 'not_started', attempt: 1 },
    });
    assert.equal(state.status, 'failed');
    assert.match(state.error, /Aucun nouvel achat automatique/);
  });
});

test('Z FOUR STORE order status returns delivered items only after completion', async () => {
  await withMockedFetch(async () => jsonResponse({
    success: true,
    data: {
      orderId: 'supplier-order-1',
      quantity: 1,
      status: 'COMPLETED',
      items: ['https://access.example/item-1'],
    },
  }), async () => {
    const state = await makeAdapter().fetchOrderState(
      { status: 'starting', attempt: 1, orderId: 'supplier-order-1' },
      target,
    );
    assert.equal(state.status, 'success');
    assert.deepEqual(state.keys, ['https://access.example/item-1']);
  });
});
