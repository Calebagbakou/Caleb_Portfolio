import { getServiceClient, jsonResponse } from '../_shared/shop.ts';
import { createProdSellerAdapter } from '../_shared/providers/prodsellerAdapter.ts';
import { createZFourStoreAdapter } from '../_shared/providers/zfourstoreAdapter.ts';
import type { ProviderAdapter, ProviderTarget } from '../_shared/providers/providerTypes.ts';

const denoEnv = (globalThis as typeof globalThis & {
  Deno: { env: { get(name: string): string | undefined } };
}).Deno.env;

const LEGACY_TARGET_KEYS: Record<string, string> = {
  'gemini-pro': 'gemini_18m',
  'canva-pro': 'canva_pro',
  'duolingo-super': 'duolingo_super_12m',
};
const PRODUCT_ID_SECRETS: Record<string, string> = {
  gemini_18m: 'PRODSELLER_GEMINI_18M_PRODUCT_ID',
  canva_pro: 'PRODSELLER_CANVA_PRODUCT_ID',
  duolingo_super_12m: 'PRODSELLER_DUOLINGO_SUPER_12M_PRODUCT_ID',
};
const ZFOURSTORE_PRODUCT_ID_SECRETS: Record<string, string> = {
  gemini_18m: 'ZFOURSTORE_GEMINI_18M_PRODUCT_ID',
  canva_pro: 'ZFOURSTORE_CANVA_PRODUCT_ID',
  duolingo_super_12m: 'ZFOURSTORE_DUOLINGO_SUPER_12M_PRODUCT_ID',
};

function getProviderProductId(provider: ProviderAdapter['id'], key: ProviderTarget['key']) {
  const secret = provider === 'zfourstore'
    ? ZFOURSTORE_PRODUCT_ID_SECRETS[key]
    : PRODUCT_ID_SECRETS[key];
  return secret ? denoEnv.get(secret)?.trim() || '' : '';
}

function getProviderConfiguration() {
  return {
    prodseller: Boolean(denoEnv.get('PRODSELLER_API_KEY')?.trim()),
    zfourstore: Boolean(denoEnv.get('ZFOURSTORE_API_KEY')?.trim()),
  };
}

function getProductProviderIds(product: {
  slug: string;
  prodseller_product_id?: string | null;
  zfourstore_product_id?: string | null;
}) {
  const legacyKey = LEGACY_TARGET_KEYS[product.slug];
  return {
    prodseller: product.prodseller_product_id?.trim() || (legacyKey ? getProviderProductId('prodseller', legacyKey) : ''),
    zfourstore: product.zfourstore_product_id?.trim() || (legacyKey ? getProviderProductId('zfourstore', legacyKey) : ''),
  };
}

const providers: Record<ProviderAdapter['id'], ProviderAdapter> = {
  prodseller: createProdSellerAdapter({
    getApiKey() {
      return denoEnv.get('PRODSELLER_API_KEY')?.trim() || '';
    },
    getProductId(target) {
      return getProviderProductId('prodseller', target.key);
    },
    isConfigured() {
      return Boolean(denoEnv.get('PRODSELLER_API_KEY')?.trim());
    },
  }),
  zfourstore: createZFourStoreAdapter({
    getApiKey() {
      return denoEnv.get('ZFOURSTORE_API_KEY')?.trim() || '';
    },
    getProductId(target) {
      return getProviderProductId('zfourstore', target.key);
    },
    isConfigured() {
      return Boolean(denoEnv.get('ZFOURSTORE_API_KEY')?.trim());
    },
  }),
};

async function requireAdmin(request: Request, client: ReturnType<typeof getServiceClient>) {
  const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return { error: jsonResponse({ error: 'Connexion administrateur requise.' }, 401) };
  const { data: { user }, error: authError } = await client.auth.getUser(accessToken);
  if (authError || !user?.id) return { error: jsonResponse({ error: 'Session administrateur invalide.' }, 401) };
  const { data: admin, error: adminError } = await client
    .from('admins')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (adminError) throw adminError;
  if (!admin) return { error: jsonResponse({ error: 'Accès administrateur requis.' }, 403) };
  return { user };
}

async function syncRuntimeConfiguration(client: ReturnType<typeof getServiceClient>) {
  const configuration = getProviderConfiguration();
  const { error } = await client.from('shop_provider_runtime').upsert([
    { provider: 'prodseller', is_configured: configuration.prodseller },
    { provider: 'zfourstore', is_configured: configuration.zfourstore },
  ], { onConflict: 'provider' });
  if (error) throw error;
  return configuration;
}

async function getOverview(client: ReturnType<typeof getServiceClient>) {
  const [productsResult, historyResult, eventResult] = await Promise.all([
    client.from('products')
      .select('id, name, slug, prodseller_product_id, zfourstore_product_id, active_api_provider')
      .eq('delivery_type', 'api')
      .order('sort_order', { ascending: true }),
    client.from('shop_provider_switch_log').select('id, target_key, from_provider, to_provider, changed_by, changed_at, reason').order('changed_at', { ascending: false }).limit(40),
    client.from('shop_provider_events').select('id, target_key, provider, event_type, created_at').order('created_at', { ascending: false }).limit(40),
  ]);
  const error = productsResult.error || historyResult.error || eventResult.error;
  if (error) throw error;
  return {
    products: (productsResult.data || []).map((product) => ({
      ...product,
      prodseller_mapping_saved: Boolean(product.prodseller_product_id?.trim()),
      zfourstore_mapping_saved: Boolean(product.zfourstore_product_id?.trim()),
      prodseller_product_id: getProductProviderIds(product).prodseller,
      zfourstore_product_id: getProductProviderIds(product).zfourstore,
      active_api_provider: product.active_api_provider || 'prodseller',
    })),
    history: historyResult.data || [],
    alerts: eventResult.data || [],
  };
}

async function checkAvailability(client: ReturnType<typeof getServiceClient>, productId: unknown) {
  if (typeof productId !== 'string' || !productId) {
    return jsonResponse({ error: 'Produit API invalide.' }, 400);
  }
  const { data: product, error: productError } = await client
    .from('products')
    .select('id, name, slug, delivery_type, prodseller_product_id, zfourstore_product_id, active_api_provider')
    .eq('id', productId)
    .eq('delivery_type', 'api')
    .maybeSingle();
  if (productError) throw productError;
  if (!product) return jsonResponse({ error: 'Produit API introuvable.' }, 404);
  const provider = product.active_api_provider === 'zfourstore' ? 'zfourstore' : 'prodseller';
  const ids = getProductProviderIds(product);
  const target: ProviderTarget = {
    key: LEGACY_TARGET_KEYS[product.slug] || product.id,
    productId: ids[provider],
    providerProductIds: ids,
    configuredProvider: provider,
    shopProductId: product.id,
    name: product.name,
    quantity: 1,
  };
  if (!target.productId || !providers[provider].isConfigured(target)) {
    return jsonResponse({ error: `L’identifiant ${provider === 'zfourstore' ? 'Z FOUR STORE' : 'ProdSeller'} de ce produit n’est pas configuré.` }, 503);
  }
  const availability = await providers[provider].checkAvailability(target);
  if (availability.message) return jsonResponse({ provider, ...availability }, 502);
  if (!availability.available && (availability.stock === 0 || availability.stock === null)) {
    const { error } = await client.from('shop_provider_events').insert({
      target_key: target.key,
      provider,
      event_type: 'out_of_stock',
    });
    if (error) throw error;
  }
  return jsonResponse({ provider, ...availability });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const client = getServiceClient();
    const admin = await requireAdmin(request, client);
    if ('error' in admin) return admin.error;
    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : '';
    if (action === 'overview') {
      const providers = await syncRuntimeConfiguration(client);
      return jsonResponse({ ...(await getOverview(client)), providers });
    }
    if (action === 'availability') return await checkAvailability(client, body?.productId);
    return jsonResponse({ error: 'Action invalide.' }, 400);
  } catch (error) {
    console.error('Erreur de gestion des fournisseurs boutique :', error instanceof Error ? error.message : 'Unknown error');
    return jsonResponse({ error: 'Impossible de charger les informations fournisseur.' }, 500);
  }
});
