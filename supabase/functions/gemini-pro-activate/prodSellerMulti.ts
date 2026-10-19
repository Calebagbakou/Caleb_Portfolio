import { getServiceClient, jsonResponse } from '../_shared/shop.ts';

const PRODSELLER_API_URL = 'https://prodseller.com/v1';
const ACTIVATION_TABLE = 'gemini_pro_activations';
const denoEnv = (globalThis as typeof globalThis & {
  Deno: { env: { get(name: string): string | undefined } };
}).Deno.env;

type ProviderTarget = {
  key: 'gemini_18m' | 'canva_pro';
  productId: string;
  shopProductId: string;
  name: string;
  quantity: number;
};

type ProviderOrderState = {
  status: string;
  orderId?: string;
  attempt: number;
  idempotencyKey?: string;
  externalStatus?: string;
  keys?: string[];
  error?: string;
};

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

function getProductId(key: ProviderTarget['key']) {
  const secret = key === 'gemini_18m'
    ? 'PRODSELLER_GEMINI_18M_PRODUCT_ID'
    : 'PRODSELLER_CANVA_PRODUCT_ID';
  return denoEnv.get(secret)?.trim() || '';
}

async function prodsellerRequest(path: string, apiKey: string, init: RequestInit = {}) {
  return fetch(`${PRODSELLER_API_URL}${path}`, {
    ...init,
    headers: {
      'X-API-Key': apiKey,
      ...(init.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
}

async function responseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function readProviderData(value: unknown): ProviderData {
  return readObject(value) as ProviderData;
}

function readKeys(value: Record<string, unknown>) {
  const rawKeys = Array.isArray(value.deliveredKeys)
    ? value.deliveredKeys
    : value.deliveredKey != null
      ? [value.deliveredKey]
      : [];
  return rawKeys.map((key) => typeof key === 'string' ? key.trim() : '').filter(Boolean);
}

function legacyActivationResponse(record: ActivationRecord) {
  const legacyData = readObject(record.pixverify_data);
  const links = Array.isArray(legacyData.links)
    ? legacyData.links.filter((link): link is string => typeof link === 'string')
    : record.result_url
      ? [record.result_url]
      : [];
  return { status: record.status, links, products: [], accessKeys: [] };
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
  const products = targets.map((target) => ({
    key: target.key,
    productId: target.shopProductId,
    name: target.name,
    quantity: target.quantity,
    status: items[target.key]?.status || 'not_started',
    accessKeys: items[target.key]?.keys || [],
    error: items[target.key]?.error || '',
  }));
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
    .select('id, slug, name')
    .in('id', productIds);
  if (productsError) throw productsError;
  const productsById = new Map((products || []).map((product: { id: string; slug: string; name: string }) => [product.id, product]));
  const geminiItems = (orderItems || []).filter((item: { product_id: string }) =>
    productsById.get(item.product_id)?.slug === 'gemini-pro',
  );
  const planIds = [...new Set(geminiItems.map((item: { plan_id: string }) => item.plan_id).filter(Boolean))];
  const { data: plans, error: plansError } = planIds.length
    ? await client.from('product_plans').select('id, slug').in('id', planIds)
    : { data: [], error: null };
  if (plansError) throw plansError;
  const geminiPlanIds = new Set(
    (plans || [])
      .filter((plan: { slug: string }) => plan.slug === '18mois')
      .map((plan: { id: string }) => plan.id),
  );

  const groups = new Map<ProviderTarget['key'], ProviderTarget>();
  for (const item of orderItems || []) {
    const product = productsById.get(item.product_id);
    let key: ProviderTarget['key'] | null = null;
    if (product?.slug === 'gemini-pro' && geminiPlanIds.has(item.plan_id)) key = 'gemini_18m';
    if (product?.slug === 'canva-pro') key = 'canva_pro';
    if (!key) continue;

    const configuredId = getProductId(key);
    if (!configuredId) {
      return { error: `L’identifiant ProdSeller du produit ${key === 'canva_pro' ? 'Canva Pro' : 'Gemini Pro 18 mois'} n’est pas configuré.`, status: 503 as const };
    }
    const current = groups.get(key);
    if (current) current.quantity += Number(item.qty);
    else {
      groups.set(key, {
        key,
        productId: configuredId,
        shopProductId: item.product_id,
        name: String(product?.name || item.product_name || (key === 'canva_pro' ? 'Canva Pro' : 'Gemini Pro 18 mois')),
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
  const providerData: ProviderData = { provider: 'prodseller', items };
  const { error } = await client
    .from(ACTIVATION_TABLE)
    .update({
      provider: 'prodseller',
      status: getAggregateStatus(items, targets),
      provider_data: providerData,
    })
    .eq('id', activationId);
  if (error) throw error;
}

async function loadProduct(apiKey: string, productId: string) {
  const response = await prodsellerRequest(`/products/${encodeURIComponent(productId)}`, apiKey);
  const result = await responseJson(response);
  if (!response.ok) return { product: null as Record<string, unknown> | null };
  return { product: (result.product || result) as Record<string, unknown> };
}

async function listProducts(apiKey: string) {
  const response = await prodsellerRequest('/products', apiKey);
  const result = await responseJson(response);
  if (!response.ok || !Array.isArray(result.products)) {
    return jsonResponse({ error: 'Le catalogue fournisseur est momentanément indisponible.' }, 502);
  }
  return jsonResponse({
    products: result.products.map((product: Record<string, unknown>) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      publicPrice: product.publicPrice,
      stock: product.stock,
      inStock: product.inStock,
      requiresEmailActivation: product.requiresEmailActivation,
    })),
  });
}

async function fetchOrderState(apiKey: string, state: ProviderOrderState, target: ProviderTarget) {
  if (!state.orderId) return state;
  let response: Response;
  try {
    response = await prodsellerRequest(`/orders/${encodeURIComponent(state.orderId)}`, apiKey);
  } catch {
    return { ...state, status: 'retryable', error: 'La vérification de l’activation est momentanément indisponible.' };
  }
  const result = await responseJson(response);
  if (!response.ok) {
    return { ...state, status: 'retryable', error: 'La vérification de l’activation est momentanément indisponible.' };
  }
  const externalStatus = String(result.status || '').toLowerCase();
  const keys = readKeys(result);
  if (externalStatus === 'delivered') {
    if (keys.length !== target.quantity) {
      return { ...state, status: 'failed', externalStatus, keys, error: 'Le nombre d’accès livré ne correspond pas à la quantité commandée.' };
    }
    return { ...state, status: 'success', externalStatus, keys, error: undefined };
  }
  if (externalStatus === 'failed') {
    return { ...state, status: 'failed', externalStatus, error: 'La livraison a échoué chez le fournisseur.' };
  }
  return { ...state, status: 'starting', externalStatus, keys: [], error: undefined };
}

async function createOrder(
  apiKey: string,
  orderId: string,
  customer: { email?: string | null } | null,
  target: ProviderTarget,
  attempt: number,
  product: Record<string, unknown>,
  state: ProviderOrderState,
) {
  if (product.inStock === false || product.stock === 0) {
    return { ...state, status: 'failed', error: 'Le produit est actuellement indisponible.' };
  }
  if (typeof product.requiresEmailActivation !== 'boolean') {
    return { ...state, status: 'retryable', error: 'ProdSeller ne précise pas si ce produit exige une adresse e-mail. Aucun achat n’a été lancé.' };
  }

  const body: Record<string, unknown> = { productId: target.productId, quantity: target.quantity };
  if (product.requiresEmailActivation) {
    const email = String(customer?.email || '').trim().toLowerCase();
    if (!email) return { ...state, status: 'failed', error: 'Aucune adresse e-mail client ne permet de réaliser l’activation.' };
    if (target.quantity === 1) body.email = email;
    else body.emails = Array.from({ length: target.quantity }, () => email);
  }

  const idempotencyKey = `caleb-${target.key}-${orderId}-${attempt}`.slice(0, 100);
  let response: Response;
  try {
    response = await prodsellerRequest('/orders', apiKey, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(body),
    });
  } catch {
    return { ...state, status: 'retryable', attempt, idempotencyKey, error: 'La réponse du fournisseur est incertaine. Une nouvelle tentative réutilisera la clé d’idempotence.' };
  }

  const result = await responseJson(response);
  if (!response.ok) {
    if (response.status === 402) {
      return { ...state, status: 'insufficient_balance', attempt: attempt + 1, idempotencyKey, error: 'Le solde du fournisseur est insuffisant. Rechargez-le avant de réessayer.' };
    }
    if (response.status === 409) {
      return { ...state, status: 'failed', attempt, idempotencyKey, error: 'Le fournisseur indique que le produit est indisponible ou déjà traité.' };
    }
    const retryable = ![400, 401, 404].includes(response.status);
    return {
      ...state,
      status: retryable ? 'retryable' : 'failed',
      attempt: retryable ? attempt : attempt + 1,
      idempotencyKey,
      error: response.status === 429
        ? 'Le fournisseur limite temporairement les requêtes. Réessayez plus tard.'
        : 'La commande fournisseur n’a pas pu être créée. Vérifiez la configuration avant de réessayer.',
    };
  }

  const orderId = typeof result.orderId === 'string' ? result.orderId : '';
  if (!orderId) {
    return { ...state, status: 'retryable', attempt, idempotencyKey, error: 'La réponse fournisseur ne contient pas de référence de commande. Réessayez avec la même référence.' };
  }
  const externalStatus = String(result.status || '').toLowerCase();
  const keys = readKeys(result);
  if (externalStatus === 'delivered') {
    if (keys.length !== target.quantity) {
      return { ...state, orderId, status: 'failed', attempt, idempotencyKey, externalStatus, keys, error: 'Le nombre d’accès livré ne correspond pas à la quantité commandée.' };
    }
    return { ...state, orderId, status: 'success', attempt, idempotencyKey, externalStatus, keys, error: undefined };
  }
  if (externalStatus === 'failed') {
    return { ...state, orderId, status: 'failed', attempt, idempotencyKey, externalStatus, error: 'La livraison a échoué chez le fournisseur.' };
  }
  return { ...state, orderId, status: 'starting', attempt, idempotencyKey, externalStatus, keys: [] };
}

async function processTargets(
  client: ReturnType<typeof getServiceClient>,
  activation: ActivationRecord,
  order: { id: string },
  customer: { email?: string | null } | null,
  targets: ProviderTarget[],
  action: string,
  apiKey: string,
) {
  const providerData = readProviderData(activation.provider_data);
  const items = { ...(providerData.items as Record<string, ProviderOrderState> || {}) };
  const needsCreate = targets.filter((target) => {
    const state = items[target.key];
    return !state || (!state.orderId && ['retryable', 'insufficient_balance', 'starting'].includes(state.status));
  });

  const loadedProducts = new Map<string, Record<string, unknown>>();
  if (action !== 'status') {
    const products = await Promise.all(needsCreate.map(async (target) => ({
      target,
      ...(await loadProduct(apiKey, target.productId)),
    })));
    for (const entry of products) {
      if (!entry.product || entry.product.id !== entry.target.productId) {
        items[entry.target.key] = {
          ...(items[entry.target.key] || { status: 'not_started', attempt: 1 }),
          status: 'retryable',
          error: 'Le produit configuré est introuvable. Vérifiez son identifiant dans les secrets Supabase; aucun achat n’a été lancé.',
        };
      } else if (typeof entry.product.requiresEmailActivation !== 'boolean') {
        items[entry.target.key] = {
          ...(items[entry.target.key] || { status: 'not_started', attempt: 1 }),
          status: 'retryable',
          error: 'ProdSeller ne précise pas si ce produit exige un e-mail. Aucun achat n’a été lancé.',
        };
      } else if (entry.product.inStock === false || entry.product.stock === 0) {
        items[entry.target.key] = {
          ...(items[entry.target.key] || { status: 'not_started', attempt: 1 }),
          status: 'failed',
          error: 'Le produit est actuellement indisponible.',
        };
      } else {
        loadedProducts.set(entry.target.key, entry.product);
      }
    }
  }

  for (const target of targets) {
    const current = items[target.key] || { status: 'not_started', attempt: 1 };
    if (current.status === 'success' || current.status === 'failed') continue;
    if (current.orderId) {
      if (action === 'deliver' || action === 'status' || action === 'retry') {
        items[target.key] = await fetchOrderState(apiKey, current, target);
      }
      continue;
    }
    if (action === 'status') continue;
    if (current.status === 'insufficient_balance' && action !== 'retry') continue;
    if (current.status === 'retryable' && action !== 'retry') continue;
    if (current.status === 'starting' && action !== 'deliver' && action !== 'retry') continue;

    const product = loadedProducts.get(target.key);
    if (!product) continue;
    const attempt = current.status === 'insufficient_balance'
      ? current.attempt
      : current.attempt || 1;
    items[target.key] = await createOrder(apiKey, order.id, customer, target, attempt, product, current);
    await saveActivation(client, activation.id, items, targets);
  }

  await saveActivation(client, activation.id, items, targets);
  return publicActivationResponse(activation, targets, items);
}

export async function handleProdSellerActivation(request: Request) {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : 'invalid';
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
      return await listProducts(getApiKey());
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
    if (!activation && action === 'status') {
      return jsonResponse(publicActivationResponse(null, targets, {}));
    }
    if (!activation && action === 'retry') return jsonResponse({ error: 'Aucune demande existante à réessayer.' }, 409);

    if (activation && activation.provider !== 'prodseller' && readProviderData(activation.provider_data).provider !== 'prodseller') {
      if (activation.status === 'success') return jsonResponse(legacyActivationResponse(activation));
      return jsonResponse({ status: 'failed', error: 'Une demande existe avec l’ancien service d’activation. Contactez l’assistance avant toute nouvelle tentative.' }, 409);
    }

    if (!activation) {
      const { data, error } = await client
        .from(ACTIVATION_TABLE)
        .insert({
          order_id: order.id,
          provider: 'prodseller',
          status: 'starting',
          provider_data: { provider: 'prodseller', items: {} },
        })
        .select('id, status, result_url, pixverify_data, provider, provider_data')
        .single();
      if (error) {
        if (error.code === '23505') activation = await loadActivation(client, order.id);
        else throw error;
      } else activation = data as ActivationRecord;
    }
    if (!activation) return jsonResponse({ status: 'starting', links: [], products: [], accessKeys: [] });

    const providerData = readProviderData(activation.provider_data);
    const existingItems = providerData.items as Record<string, ProviderOrderState> || {};
    if (action === 'deliver' && activation.status === 'starting' && Object.keys(existingItems).length) {
      return jsonResponse(publicActivationResponse(activation, targets, existingItems));
    }
    const result = await processTargets(client, activation, order, customer, targets, action, getApiKey());
    const aggregate = result.status;
    const responseStatus = aggregate === 'failed' ? 502 : aggregate === 'insufficient_balance' ? 402 : 200;
    return jsonResponse(result, responseStatus);
  } catch (error) {
    console.error('Erreur de traitement des accès ProdSeller :', error instanceof Error ? error.message : 'Unknown error');
    return jsonResponse({ error: 'Erreur serveur lors du traitement des accès.' }, 500);
  }
}
