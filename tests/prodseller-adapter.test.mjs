import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProdSellerAdapter } from '../supabase/functions/_shared/providers/prodsellerAdapter.ts';

const target = {
  key: 'gemini_18m',
  productId: 'gemini-product-id',
  shopProductId: 'shop-product-id',
  name: 'Gemini Pro 18 mois',
  quantity: 1,
};

function makeAdapter() {
  return createProdSellerAdapter({
    getApiKey: () => 'test-api-key',
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

test('ProdSeller order creation preserves idempotency and the existing success shape', async () => {
  let requestDetails;
  await withMockedFetch(async (url, init) => {
    requestDetails = { url, init };
    return jsonResponse({ orderId: 'supplier-order-1', status: 'delivered', deliveredKeys: ['activation-key'] });
  }, async () => {
    const state = await makeAdapter().createOrder(target, 'caleb-gemini_18m-order-1-1', {
      orderId: 'order-1',
      customer: { email: 'buyer@example.com' },
      attempt: 1,
      product: { requiresEmailActivation: true },
      previousState: { status: 'not_started', attempt: 1 },
    });

    assert.equal(state.status, 'success');
    assert.equal(state.orderId, 'supplier-order-1');
    assert.deepEqual(state.keys, ['activation-key']);
    assert.deepEqual(makeAdapter().normalize(state), {
      status: 'success',
      links: [],
      accessKeys: ['activation-key'],
    });
    assert.equal(requestDetails.url, 'https://prodseller.com/v1/orders');
    assert.equal(requestDetails.init.headers['Idempotency-Key'], 'caleb-gemini_18m-order-1-1');
    assert.deepEqual(JSON.parse(requestDetails.init.body), {
      productId: 'gemini-product-id',
      quantity: 1,
      email: 'buyer@example.com',
    });
  });
});

test('Canva targets keep the same ProdSeller purchase behavior', async () => {
  const canvaTarget = {
    ...target,
    key: 'canva_pro',
    productId: 'canva-product-id',
    shopProductId: 'canva-shop-product-id',
    name: 'Canva Pro',
  };
  await withMockedFetch(async (_url, init) => {
    assert.deepEqual(JSON.parse(init.body), {
      productId: 'canva-product-id',
      quantity: 1,
    });
    return jsonResponse({ orderId: 'canva-order-1', status: 'delivered', deliveredKey: 'canva-key' });
  }, async () => {
    const state = await makeAdapter().createOrder(canvaTarget, 'canva-idempotency-key', {
      orderId: 'canva-order',
      customer: null,
      attempt: 1,
      product: { requiresEmailActivation: false },
      previousState: { status: 'not_started', attempt: 1 },
    });
    assert.equal(state.status, 'success');
    assert.deepEqual(state.keys, ['canva-key']);
  });
});

test('ProdSeller insufficient balance preserves the retry status and message', async () => {
  await withMockedFetch(async () => jsonResponse({ error: 'insufficient balance' }, 402), async () => {
    const state = await makeAdapter().createOrder(target, 'same-idempotency-key', {
      orderId: 'order-1',
      customer: null,
      attempt: 1,
      product: { requiresEmailActivation: false },
      previousState: { status: 'retryable', attempt: 1 },
    });

    assert.equal(state.status, 'insufficient_balance');
    assert.equal(state.attempt, 2);
    assert.equal(state.idempotencyKey, 'same-idempotency-key');
    assert.equal(state.error, 'Le solde du fournisseur est insuffisant. Rechargez-le avant de réessayer.');
  });
});

test('availability and order lookup use the expected provider data without exposing credentials', async () => {
  const urls = [];
  await withMockedFetch(async (url) => {
    urls.push(String(url));
    if (String(url).includes('/products/')) {
      return jsonResponse({ product: { stock: 4, inStock: true } });
    }
    return jsonResponse({ orderId: 'supplier-order-2', status: 'delivered', deliveredKeys: ['key-2'] });
  }, async () => {
    const adapter = makeAdapter();
    assert.deepEqual(await adapter.checkAvailability(target), {
      available: true,
      stock: 4,
      balanceOk: null,
    });
    const state = await adapter.fetchOrderState(
      { status: 'starting', attempt: 1, orderId: 'supplier-order-2' },
      target,
    );
    assert.equal(state.status, 'success');
    assert.deepEqual(state.keys, ['key-2']);
    assert.deepEqual(urls, [
      'https://prodseller.com/v1/products/gemini-product-id',
      'https://prodseller.com/v1/orders/supplier-order-2',
    ]);
    assert.equal(JSON.stringify(state).includes('test-api-key'), false);
  });
});

test('catalogue errors remain in the existing public response format', async () => {
  await withMockedFetch(async () => jsonResponse({}, 401), async () => {
    const result = await makeAdapter().listProducts();
    assert.equal(result.status, 502);
    assert.deepEqual(result.body, {
      error: 'ProdSeller refuse la clé API configurée. Vérifiez le secret PRODSELLER_API_KEY dans Supabase.',
      providerStatus: 401,
    });
    assert.equal(JSON.stringify(result).includes('test-api-key'), false);
  });
});
