import { getServiceClient, jsonResponse } from './shop.ts';
import { getProdSellerTargetKey, isApiDelivery } from './delivery.ts';
import { createProdSellerAdapter } from './providers/prodsellerAdapter.ts';
import { createZFourStoreAdapter } from './providers/zfourstoreAdapter.ts';
import type {
  ProviderAdapter,
  ProviderOrderState,
  ProviderTarget,
} from './providers/providerTypes.ts';
import {
  resolvePinnedProvider,
  resolveProvider as resolveConfiguredProvider,
  shouldCreateProviderOrder,
} from './providers/providerRouting.mjs';

const ACTIVATION_TABLE = 'gemini_pro_activations';
const denoEnv = (globalThis as typeof globalThis & {
  Deno: { env: { get(name: string): string | undefined } };
}).Deno.env;
const AVAILABILITY_CACHE_TTL = 20_000;
const availabilityCache = new Map<string, { available: boolean; expiresAt: number }>();

type ProviderData = {
  provider?: string;
  items?: Record<string, ProviderOrderState>;
  [key: string]: unknown;
};

type ActivationRecord = {
  id: string;
  status: string;
  result_url: string | null;
  pixverify_data: unknown;
  provider: string | null;
  provider_data: unknown;
};

function getApiKey() {
  const apiKey = denoEnv.get('PRODSELLER_API_KEY');
  if (!apiKey) throw new Error('La clé API du fournisseur n’est pas configurée.');
  return apiKey;
}

function getZFourStoreApiKey() {
  const apiKey = denoEnv.get('ZFOURSTORE_API_KEY');
  if (!apiKey) throw new Error('La clé API Z FOUR STORE n’est pas configurée.');
  return apiKey;
}

const LEGACY_PRODUCT_ID_SECRETS: Record<string, string> = {
  gemini_18m: 'PRODSELLER_GEMINI_18M_PRODUCT_ID',
  canva_pro: 'PRODSELLER_CANVA_PRODUCT_ID',
  duolingo_super_12m: 'PRODSELLER_DUOLINGO_SUPER_12M_PRODUCT_ID',
};
const LEGACY_ZFOURSTORE_PRODUCT_ID_SECRETS: Record<string, string> = {
  gemini_18m: 'ZFOURSTORE_GEMINI_18M_PRODUCT_ID',
  canva_pro: 'ZFOURSTORE_CANVA_PRODUCT_ID',
  duolingo_super_12m: 'ZFOURSTORE_DUOLINGO_SUPER_12M_PRODUCT_ID',
};

function getProductId(key: string, provider: ProviderAdapter['id'] = 'prodseller') {
  const secret = provider === 'zfourstore'
    ? LEGACY_ZFOURSTORE_PRODUCT_ID_SECRETS[key]
    : LEGACY_PRODUCT_ID_SECRETS[key];
  return secret ? denoEnv.get(secret)?.trim() || '' : '';
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function readProviderData(value: unknown): ProviderData {
  return readObject(value) as ProviderData;
}

function getActivationProvider(items: Record<string, ProviderOrderState> = {}): ProviderAdapter['id'] {
  const providers = new Set<ProviderAdapter['id']>();
  for (const state of Object.values(items)) {
    const provider = state?.provider;
    if (provider === 'prodseller' || provider === 'zfourstore') providers.add(provider);
  }
  return providers.has('zfourstore') ? 'zfourstore' : 'prodseller';
}

function legacyActivationResponse(record: ActivationRecord, targets: ProviderTarget[]) {
  const legacyData = readObject(record.pixverify_data);
  const links = Array.isArray(legacyData.links)
    ? legacyData.links.filter((link): link is string => typeof link === 'string')
    : record.result_url
      ? [record.result_url]
      : [];
  const products = targets.map((target) => {
    const legacyGeminiLinks = target.key === 'gemini_18m' ? links : [];
    return {
      key: target.key,
      productId: target.shopProductId,
      name: target.name,
      quantity: target.quantity,
      status: legacyGeminiLinks.length ? 'success' : 'not_started',
      accessKeys: legacyGeminiLinks,
      error: '',
    };
  });
  return { status: record.status, links: [], products, accessKeys: products.flatMap((product) => product.accessKeys) };
}

function getAggregateStatus(items: Record<string, ProviderOrderState>, targets: ProviderTarget[]) {
  const states = targets.map((target) => items[target.key]?.status || 'not_started');
  if (states.every((status) => status === 'success')) return 'success';
  if (states.includes('insufficient_balance')) return 'insufficient_balance';
  if (states.includes('failed')) return 'failed';
  if (states.includes('retryable')) return 'retryable';
  if (states.every((status) => status === 'not_started')) return 'not_started';
  return 'starting';
}

function publicActivationResponse(
  record: ActivationRecord | null,
  targets: ProviderTarget[],
  items: Record<string, ProviderOrderState>,
) {
  const products = targets.map((target) => {
    const state = items[target.key] || { status: 'not_started', attempt: 1 };
    const adapter = providerAdapters[state.provider || 'prodseller'] || prodsellerAdapter;
    const normalized = adapter.normalize(state);
    return {
      key: target.key,
      productId: target.shopProductId,
      name: target.name,
      quantity: target.quantity,
      status: normalized.status,
      accessKeys: normalized.accessKeys,
      error: state.error || '',
    };
  });
  return {
    status: record ? getAggregateStatus(items, targets) : 'not_started',
    links: [],
    products,
    accessKeys: products.flatMap((product) => product.accessKeys),
  };
}

async function getPaidProviderOrder(
  client: ReturnType<typeof getServiceClient>,
  orderId: unknown,
  orderRef: unknown,
  buyerEmail: string,
) {
  if (typeof orderId !== 'string' || typeof orderRef !== 'string' || !orderId || !orderRef) {
    return { error: 'Commande invalide.', status: 400 as const };
  }

  const { data: order, error: orderError } = await client
    .from('orders')
    .select('id, ref, payment_status, customers!inner(email)')
    .eq('id', orderId)
    .eq('ref', orderRef)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) return { error: 'Commande introuvable.', status: 404 as const };
  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  if (String(customer?.email || '').trim().toLowerCase() !== buyerEmail.trim().toLowerCase()) {
    return { error: 'Cette commande ne correspond pas à votre compte.', status: 403 as const };
  }
  if (order.payment_status !== 'confirme') {
    return { error: 'Le paiement de cette commande n’est pas confirmé.', status: 403 as const };
  }

  const { data: orderItems, error: itemsError } = await client
    .from('order_items')
    .select('product_id, plan_id, product_name, qty')
    .eq('order_id', order.id);
  if (itemsError) throw itemsError;
  const productIds = [...new Set((orderItems || []).map((item: { product_id: string }) => item.product_id))];
  if (!productIds.length) return { order, customer, targets: [] as ProviderTarget[] };

  const { data: products, error: productsError } = await client
    .from('products')
    .select('id, slug, name, delivery_type, prodseller_product_id, zfourstore_product_id, active_api_provider')
    .in('id', productIds);
  if (productsError) throw productsError;
  const productsById = new Map((products || []).map((product: {
    id: string;
    slug: string;
    name: string;
    delivery_type: string;
    prodseller_product_id: string | null;
    zfourstore_product_id: string | null;
    active_api_provider: ProviderAdapter['id'] | null;
  }) => [product.id, product]));
  const apiItems = (orderItems || []).filter((item: { product_id: string }) =>
    isApiDelivery(productsById.get(item.product_id)),
  );
  const planIds = [...new Set(apiItems.map((item: { plan_id: string }) => item.plan_id).filter(Boolean))];
  const { data: plans, error: plansError } = planIds.length
    ? await client.from('product_plans').select('id, slug').in('id', planIds)
    : { data: [], error: null };
  if (plansError) throw plansError;
  const planSlugsById = new Map((plans || []).map((plan: { id: string; slug: string }) => [plan.id, plan.slug]));

  const groups = new Map<string, ProviderTarget>();
  for (const item of apiItems) {
    const product = productsById.get(item.product_id);
    const key = product ? getProdSellerTargetKey(product, planSlugsById.get(item.plan_id)) : null;
    if (!key) continue;
    const productRecord = product as {
      id: string;
      slug: string;
      name: string;
      delivery_type: string;
      prodseller_product_id?: string | null;
      zfourstore_product_id?: string | null;
      active_api_provider?: ProviderAdapter['id'] | null;
    };

    const current = groups.get(key);
    if (current) current.quantity += Number(item.qty);
    else {
      groups.set(key, {
        key,
        productId: '',
        providerProductIds: {
          prodseller: productRecord.prodseller_product_id || getProductId(key, 'prodseller'),
          zfourstore: productRecord.zfourstore_product_id || getProductId(key, 'zfourstore'),
        },
        configuredProvider: productRecord.active_api_provider === 'zfourstore' ? 'zfourstore' : 'prodseller',
        shopProductId: item.product_id,
        name: String(productRecord.name || item.product_name || 'Produit API'),
        quantity: Number(item.qty),
      });
    }
  }

  const targets = [...groups.values()];
  if (targets.some((target) => !Number.isSafeInteger(target.quantity) || target.quantity < 1 || target.quantity > 20)) {
    return { error: 'La quantité d’un produit ne peut pas être traitée automatiquement.', status: 400 as const };
  }
  return { order, customer, targets };
}

async function loadActivation(client: ReturnType<typeof getServiceClient>, orderId: string) {
  const { data, error } = await client
    .from(ACTIVATION_TABLE)
    .select('id, status, result_url, pixverify_data, provider, provider_data')
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) throw error;
  return data as ActivationRecord | null;
}

async function saveActivation(
  client: ReturnType<typeof getServiceClient>,
  activationId: string,
  items: Record<string, ProviderOrderState>,
  targets: ProviderTarget[],
) {
  const provider = getActivationProvider(items);
  const providerData: ProviderData = { routingVersion: 1, provider, items };
  const { error } = await client
    .from(ACTIVATION_TABLE)
    .update({
      provider,
      status: getAggregateStatus(items, targets),
      provider_data: providerData,
    })
    .eq('id', activationId);
  if (error) throw error;
}

async function getProductAvailability(client: ReturnType<typeof getServiceClient>, slug: string) {
  if (!slug) return jsonResponse({ error: 'Produit API inconnu.' }, 400);
  const { data: product, error } = await client
    .from('products')
    .select('id, slug, name, delivery_type, prodseller_product_id, zfourstore_product_id, active_api_provider')
    .eq('slug', slug)
    .eq('delivery_type', 'api')
    .maybeSingle();
  if (error) throw error;
  if (!product) return jsonResponse({ error: 'Produit API inconnu.' }, 404);
  const key = getProdSellerTargetKey(product);
  if (!key) return jsonResponse({ error: 'Produit API inconnu.' }, 400);

  const target: ProviderTarget = {
    key,
    productId: '',
    providerProductIds: {
      prodseller: '',
      zfourstore: '',
    },
    configuredProvider: product.active_api_provider === 'zfourstore' ? 'zfourstore' : 'prodseller',
    shopProductId: product.id,
    name: product.name,
    quantity: 1,
  };
  target.providerProductIds = {
    prodseller: product.prodseller_product_id || getProductId(key, 'prodseller'),
    zfourstore: product.zfourstore_product_id || getProductId(key, 'zfourstore'),
  };
  const provider = await getConfiguredProvider(client, target);
  target.productId = getProviderProductId(provider, target);
  const adapter = providerAdapters[provider];
  const cacheKey = `${provider}:${slug}`;
  const cached = availabilityCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return jsonResponse({ available: cached.available });
  }
  if (!adapter.isConfigured(target)) {
    return jsonResponse({ error: 'La disponibilité est momentanément indisponible.' }, 503);
  }
  const availability = await adapter.checkAvailability(target);
  if (availability.message) {
    return jsonResponse({ error: 'La disponibilité est momentanément indisponible.' }, 502);
  }

  if (!availability.available && (availability.stock === 0 || availability.stock === null)) {
    await recordProviderEvent(client, target, provider, 'out_of_stock');
  }
  availabilityCache.set(cacheKey, { available: availability.available, expiresAt: Date.now() + AVAILABILITY_CACHE_TTL });
  return jsonResponse({ available: availability.available });
}

function getProviderProductId(provider: ProviderAdapter['id'], target: ProviderTarget) {
  return target.providerProductIds[provider] || getProductId(target.key, provider);
}

const prodsellerAdapter = createProdSellerAdapter({
  getApiKey,
  getProductId(target) {
    return getProviderProductId('prodseller', target);
  },
  isConfigured() {
    return Boolean(denoEnv.get('PRODSELLER_API_KEY')?.trim());
  },
});

const zfourstoreAdapter = createZFourStoreAdapter({
  getApiKey: getZFourStoreApiKey,
  getProductId(target) {
    return getProviderProductId('zfourstore', target);
  },
  isConfigured() {
    return Boolean(denoEnv.get('ZFOURSTORE_API_KEY')?.trim());
  },
});

const providerAdapters: Record<ProviderAdapter['id'], ProviderAdapter> = {
  prodseller: prodsellerAdapter,
  zfourstore: zfourstoreAdapter,
};

async function getConfiguredProvider(_client: ReturnType<typeof getServiceClient>, target: ProviderTarget) {
  return resolveConfiguredProvider(target.key, target.configuredProvider);
}

async function recordProviderEvent(
  client: ReturnType<typeof getServiceClient>,
  target: ProviderTarget,
  provider: ProviderAdapter['id'],
  eventType: 'out_of_stock' | 'insufficient_balance',
) {
  const { error } = await client.from('shop_provider_events').insert({
    target_key: target.key,
    provider,
    event_type: eventType,
  });
  if (error) throw error;
}

async function processTargets(
  client: ReturnType<typeof getServiceClient>,
  activation: ActivationRecord,
  order: { id: string },
  customer: { email?: string | null } | null,
  targets: ProviderTarget[],
  action: string,
) {
  const providerData = readProviderData(activation.provider_data);
  const items = { ...(providerData.items as Record<string, ProviderOrderState> || {}) };
  const { data: zfourstoreClaims, error: claimsError } = await client
    .from('shop_provider_order_claims')
    .select('target_key, status, provider_order_id')
    .eq('activation_id', activation.id);
  if (claimsError) throw claimsError;
  for (const claim of zfourstoreClaims || []) {
    const state = items[claim.target_key];
    if (claim.status === 'released') continue;
    items[claim.target_key] = {
      ...(state || { status: 'starting', attempt: 1 }),
      provider: 'zfourstore',
      status: state?.status === 'success' ? 'success' : 'starting',
      ...(claim.provider_order_id ? { orderId: claim.provider_order_id } : {}),
      ...(!claim.provider_order_id
        ? { error: 'Une commande Z FOUR STORE est en cours de confirmation. Ne la relance pas; contacte le support pour vérifier son état.' }
        : {}),
    };
  }
  const allowConfiguredProviderForMissing = Boolean(
    activation.provider === null
    && providerData.routingVersion === 1
    && !providerData.provider
    && Object.keys(items).length === 0,
  );
  const configuredProviders = new Map<string, ProviderAdapter['id']>();
  const missingStates = new Set<string>();
  await Promise.all(targets.map(async (target) => {
    const setting = await getConfiguredProvider(client, target);
    const state = items[target.key];
    if (!state) missingStates.add(target.key);
    const provider = resolvePinnedProvider(
      target.key,
      state,
      setting,
      allowConfiguredProviderForMissing,
    );
    configuredProviders.set(target.key, provider);
    if (state || action !== 'status') {
      items[target.key] = { ...(state || { status: 'not_started', attempt: 1 }), provider };
    }
  }));

  for (const target of targets) {
    const provider = configuredProviders.get(target.key) || 'prodseller';
    target.productId = getProviderProductId(provider, target);
  }

  if (action !== 'status') await saveActivation(client, activation.id, items, targets);
  const candidates = targets.filter((target) =>
    shouldCreateProviderOrder(items[target.key], action, missingStates.has(target.key)),
  );
  const needsCreate = candidates.filter((target) => {
    const state = items[target.key];
    const provider = state?.provider || 'prodseller';
    const adapter = providerAdapters[provider];
    if (adapter.isConfigured(target)) return true;
    items[target.key] = {
      ...(state || { status: 'not_started', attempt: 1 }),
      provider,
      status: 'retryable',
      error: `La configuration ${provider === 'zfourstore' ? 'Z FOUR STORE' : 'ProdSeller'} est incomplète. Vérifiez les secrets Supabase.`,
    };
    return false;
  });

  const loadedProducts = new Map<string, Record<string, unknown>>();
  if (action !== 'status') {
    const products = await Promise.all(needsCreate.map(async (target) => {
      const provider = items[target.key]?.provider || 'prodseller';
      return {
        target,
        provider,
        product: await providerAdapters[provider].loadProduct(target),
      };
    }));
    for (const entry of products) {
      if (!entry.product || entry.product.id !== entry.target.productId) {
        items[entry.target.key] = {
          ...(items[entry.target.key] || { status: 'not_started', attempt: 1 }),
          status: 'retryable',
          provider: entry.provider,
          error: `Le produit configuré est introuvable chez ${entry.provider === 'zfourstore' ? 'Z FOUR STORE' : 'ProdSeller'}. Vérifiez son identifiant dans la fiche du produit; aucun achat n’a été lancé.`,
        };
      } else if (entry.provider === 'prodseller' && typeof entry.product.requiresEmailActivation !== 'boolean') {
        items[entry.target.key] = {
          ...(items[entry.target.key] || { status: 'not_started', attempt: 1 }),
          status: 'retryable',
          provider: entry.provider,
          error: 'ProdSeller ne précise pas si ce produit exige un e-mail. Aucun achat n’a été lancé.',
        };
      } else if (entry.product.inStock === false || entry.product.stock === 0) {
        items[entry.target.key] = {
          ...(items[entry.target.key] || { status: 'not_started', attempt: 1 }),
          status: 'failed',
          provider: entry.provider,
          error: 'Le produit est actuellement indisponible.',
        };
        await recordProviderEvent(client, entry.target, entry.provider, 'out_of_stock');
      } else {
        loadedProducts.set(entry.target.key, entry.product);
      }
    }
  }

  for (const target of targets) {
    const current = items[target.key] || { status: 'not_started', attempt: 1 };
    const provider = current.provider || 'prodseller';
    const adapter = providerAdapters[provider];
    if (current.status === 'success' || current.status === 'failed') continue;
    if (current.orderId) {
      if (action === 'deliver' || action === 'status' || action === 'retry') {
        items[target.key] = { ...await adapter.fetchOrderState(current, target), provider };
      }
      continue;
    }
    if (!shouldCreateProviderOrder(items[target.key], action, missingStates.has(target.key))) continue;

    const product = loadedProducts.get(target.key);
    if (!product) continue;
    if (provider === 'zfourstore') {
      const { data: claimed, error: claimError } = await client.rpc('claim_shop_provider_order', {
        p_activation_id: activation.id,
        p_target_key: target.key,
      });
      if (claimError) throw claimError;
      if (!claimed) {
        const { data: existingClaim, error: existingClaimError } = await client
          .from('shop_provider_order_claims')
          .select('status, provider_order_id')
          .eq('activation_id', activation.id)
          .eq('target_key', target.key)
          .maybeSingle();
        if (existingClaimError) throw existingClaimError;
        const latest = await loadActivation(client, order.id);
        const latestItems = {
          ...(readProviderData(latest?.provider_data).items as Record<string, ProviderOrderState> || {}),
        };
        latestItems[target.key] = {
          ...(latestItems[target.key] || current),
          provider: 'zfourstore',
          status: 'starting',
          ...(existingClaim?.provider_order_id ? { orderId: existingClaim.provider_order_id } : {}),
          ...(!existingClaim?.provider_order_id
            ? { error: 'Une commande Z FOUR STORE est en cours de confirmation. Ne la relance pas; contacte le support pour vérifier son état.' }
            : {}),
        };
        return publicActivationResponse(latest, targets, latestItems);
      }
      items[target.key] = {
        ...current,
        provider,
        status: 'starting',
        error: 'Commande Z FOUR STORE en cours de confirmation.',
      };
      await saveActivation(client, activation.id, items, targets);
    }
    const attempt = current.status === 'insufficient_balance'
      ? current.attempt
      : current.attempt || 1;
    const idempotencyKey = `caleb-${target.key}-${order.id}-${attempt}`.slice(0, 100);
    items[target.key] = {
      ...await adapter.createOrder(target, idempotencyKey, {
        orderId: order.id,
        customer,
        attempt,
        product,
        previousState: current,
      }),
      provider,
    };
    if (provider === 'zfourstore') {
      const claimStatus = ['retryable', 'insufficient_balance'].includes(items[target.key].status)
        ? 'released'
        : items[target.key].orderId
          ? 'submitted'
          : 'submitting';
      const { error: updateClaimError } = await client
        .from('shop_provider_order_claims')
        .update({
          status: claimStatus,
          provider_order_id: items[target.key].orderId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('activation_id', activation.id)
        .eq('target_key', target.key);
      if (updateClaimError) throw updateClaimError;
    }
    if (items[target.key].status === 'insufficient_balance') {
      await recordProviderEvent(client, target, provider, 'insufficient_balance');
    }
    await saveActivation(client, activation.id, items, targets);
  }

  if (action !== 'status' || Object.keys(items).length > 0) {
    await saveActivation(client, activation.id, items, targets);
  }
  return publicActivationResponse(activation, targets, items);
}

export async function handleProdSellerActivation(request: Request) {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : 'invalid';
    if (action === 'availability') {
      return await getProductAvailability(getServiceClient(), typeof body?.slug === 'string' ? body.slug : '');
    }
    if (action === 'categories' || action === 'products') {
      const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!accessToken) return jsonResponse({ error: 'Connexion administrateur requise.' }, 401);
      const client = getServiceClient();
      const { data: { user }, error: authError } = await client.auth.getUser(accessToken);
      if (authError || !user?.id) return jsonResponse({ error: 'Session administrateur invalide.' }, 401);
      const { data: admin, error: adminError } = await client
        .from('admins')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      if (adminError) throw adminError;
      if (!admin) return jsonResponse({ error: 'Accès administrateur requis.' }, 403);
      const apiKey = denoEnv.get('PRODSELLER_API_KEY')?.trim();
      if (!apiKey) {
        return jsonResponse({ error: 'Configuration manquante : ajoutez le secret PRODSELLER_API_KEY dans Supabase.' }, 503);
      }
      const response = await prodsellerAdapter.listProducts();
      return jsonResponse(response.body, response.status);
    }

    if (!['deliver', 'retry', 'status'].includes(action)) return jsonResponse({ error: 'Action invalide.' }, 400);
    const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Connectez-vous pour accéder à cette activation.' }, 401);
    const client = getServiceClient();
    const { data: { user }, error: authError } = await client.auth.getUser(accessToken);
    if (authError || !user?.email || !user.email_confirmed_at) {
      return jsonResponse({ error: 'Une adresse e-mail confirmée est obligatoire.' }, 401);
    }

    const orderResult = await getPaidProviderOrder(client, body.order_id, body.order_ref, user.email);
    if ('error' in orderResult) return jsonResponse({ error: orderResult.error }, orderResult.status);
    const { order, customer, targets } = orderResult;
    if (!targets.length) return jsonResponse({ status: 'not_started', links: [], products: [], accessKeys: [] });

    let activation = await loadActivation(client, order.id);
    const storedProviderData = readProviderData(activation?.provider_data);
    const storedItems = storedProviderData.items as Record<string, ProviderOrderState> || {};
    const isNewUninitializedActivation = Boolean(
      activation
      && activation.provider === null
      && storedProviderData.routingVersion === 1
      && !storedProviderData.provider
      && Object.keys(storedItems).length === 0,
    );
    if (activation && !isNewUninitializedActivation
      && activation.provider !== 'prodseller'
      && storedProviderData.provider !== 'prodseller') {
      if (activation.status === 'success') return jsonResponse(legacyActivationResponse(activation, targets));
      return jsonResponse({ status: 'failed', error: 'Une demande existe avec l’ancien service d’activation. Contactez l’assistance avant toute nouvelle tentative.' }, 409);
    }

    const resolvedProviders = new Map<string, ProviderAdapter['id']>();
    for (const target of targets) {
      const configuredProvider = await getConfiguredProvider(client, target);
      const provider = resolvePinnedProvider(
        target.key,
        storedItems[target.key],
        configuredProvider,
        !activation || isNewUninitializedActivation,
      );
      resolvedProviders.set(target.key, provider);
      target.productId = getProviderProductId(provider, target);
      if (!target.productId) {
        const productLabel = target.key === 'canva_pro'
          ? 'Canva Pro'
          : target.key === 'duolingo_super_12m'
            ? 'Duolingo Super 12 mois'
            : target.key === 'gemini_18m'
              ? 'Gemini Pro 18 mois'
              : target.name;
        const message = provider === 'prodseller'
          ? `L’identifiant ProdSeller du produit ${productLabel} n’est pas configuré.`
          : `L’identifiant Z FOUR STORE du produit ${productLabel} n’est pas configuré.`;
        return jsonResponse({ error: message }, 503);
      }
      if (!providerAdapters[provider].isConfigured(target)) {
        return jsonResponse({
          error: `La configuration ${provider === 'zfourstore' ? 'Z FOUR STORE' : 'ProdSeller'} du produit est incomplète.`,
        }, 503);
      }
    }

    if (!activation && action === 'status') {
      return jsonResponse(publicActivationResponse(null, targets, {}));
    }
    if (!activation && action === 'retry') return jsonResponse({ error: 'Aucune demande existante à réessayer.' }, 409);

    if (!activation) {
      const { data, error } = await client
        .from(ACTIVATION_TABLE)
        .insert({
          order_id: order.id,
          provider: null,
          status: 'starting',
          provider_data: { routingVersion: 1, items: {} },
        })
        .select('id, status, result_url, pixverify_data, provider, provider_data')
        .single();
      if (error) {
        if (error.code === '23505') activation = await loadActivation(client, order.id);
        else throw error;
      } else activation = data as ActivationRecord;
    }
    if (!activation) return jsonResponse({ status: 'starting', links: [], products: [], accessKeys: [] });

    if (targets.some((target) => resolvedProviders.get(target.key) === 'prodseller')) getApiKey();
    if (targets.some((target) => resolvedProviders.get(target.key) === 'zfourstore')) getZFourStoreApiKey();

    const providerData = readProviderData(activation.provider_data);
    const existingItems = providerData.items as Record<string, ProviderOrderState> || {};
    if (action === 'deliver' && activation.status === 'starting' && Object.keys(existingItems).length) {
      return jsonResponse(publicActivationResponse(activation, targets, existingItems));
    }
    const result = await processTargets(client, activation, order, customer, targets, action);
    const aggregate = result.status;
    const responseStatus = aggregate === 'failed' ? 502 : aggregate === 'insufficient_balance' ? 402 : 200;
    return jsonResponse(result, responseStatus);
  } catch (error) {
    console.error('Erreur de traitement des accès ProdSeller :', error instanceof Error ? error.message : 'Unknown error');
    return jsonResponse({ error: 'Erreur serveur lors du traitement des accès.' }, 500);
  }
}
