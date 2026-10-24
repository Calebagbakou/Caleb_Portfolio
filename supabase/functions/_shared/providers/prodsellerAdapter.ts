import type {
  ProviderAdapter,
  ProviderAvailability,
  ProviderOrderContext,
  ProviderOrderState,
  ProviderTarget,
} from './providerTypes.ts';

const API_URL = 'https://prodseller.com/v1';

type ProdSellerAdapterDependencies = {
  getApiKey(): string;
  getProductId(target: ProviderTarget): string;
  isConfigured(): boolean;
};

type ProdSellerAdapter = ProviderAdapter & {
  listProducts(): Promise<{ body: unknown; status: number }>;
};

async function request(path: string, apiKey: string, init: RequestInit = {}) {
  return fetch(`${API_URL}${path}`, {
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

function readKeys(value: Record<string, unknown>) {
  const rawKeys = Array.isArray(value.deliveredKeys)
    ? value.deliveredKeys
    : value.deliveredKey != null
      ? [value.deliveredKey]
      : [];
  return rawKeys.map((key) => typeof key === 'string' ? key.trim() : '').filter(Boolean);
}

export function createProdSellerAdapter(
  dependencies: ProdSellerAdapterDependencies,
): ProdSellerAdapter {
  async function loadProduct(target: ProviderTarget) {
    const response = await request(
      `/products/${encodeURIComponent(target.productId)}`,
      dependencies.getApiKey(),
    );
    const result = await responseJson(response);
    if (!response.ok) return null;
    return (result.product || result) as Record<string, unknown>;
  }

  async function checkAvailability(target: ProviderTarget): Promise<ProviderAvailability> {
    if (!dependencies.isConfigured() || !target.productId) {
      return { available: false, balanceOk: null, message: 'La disponibilité est momentanément indisponible.' };
    }
    let response: Response;
    try {
      response = await request(
        `/products/${encodeURIComponent(target.productId)}`,
        dependencies.getApiKey(),
        { signal: AbortSignal.timeout(8000) },
      );
    } catch {
      return { available: false, balanceOk: null, message: 'La disponibilité est momentanément indisponible.' };
    }
    const result = await responseJson(response);
    if (!response.ok) {
      console.error('ProdSeller availability request returned HTTP status:', response.status);
      return { available: false, balanceOk: null, message: 'La disponibilité est momentanément indisponible.' };
    }
    const product = result.product || result;
    if (!product || typeof product !== 'object') {
      console.error('ProdSeller availability response has an unexpected shape.');
      return { available: false, balanceOk: null, message: 'La disponibilité est momentanément indisponible.' };
    }

    const record = product as Record<string, unknown>;
    const stockValue = record.stock;
    const inStock = record.inStock;
    const stock = typeof stockValue === 'number'
      ? stockValue
      : typeof stockValue === 'string' && stockValue.trim() && Number.isFinite(Number(stockValue))
        ? Number(stockValue)
        : null;
    if (inStock === false || (stock !== null && stock <= 0)) {
      return { available: false, stock, balanceOk: null };
    }
    if (stock !== null || typeof inStock === 'boolean') {
      return { available: inStock ?? (stock !== null && stock > 0), stock, balanceOk: null };
    }
    console.error('ProdSeller availability response does not include stock information.');
    return { available: false, stock: null, balanceOk: null, message: 'La disponibilité momentanément indisponible.' };
  }

  async function fetchOrderState(
    state: ProviderOrderState,
    target: ProviderTarget,
  ): Promise<ProviderOrderState> {
    if (!state.orderId) return state;
    let response: Response;
    try {
      response = await request(
        `/orders/${encodeURIComponent(state.orderId)}`,
        dependencies.getApiKey(),
      );
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
    target: ProviderTarget,
    idempotencyKey: string,
    context: ProviderOrderContext,
  ): Promise<ProviderOrderState> {
    const { attempt, customer, product, previousState } = context;
    if (!product) {
      return { ...previousState, provider: 'prodseller', status: 'retryable' };
    }
    if (product.inStock === false || product.stock === 0) {
      return { ...previousState, status: 'failed', error: 'Le produit est actuellement indisponible.' };
    }
    if (typeof product.requiresEmailActivation !== 'boolean') {
      return { ...previousState, status: 'retryable', error: 'ProdSeller ne précise pas si ce produit exige une adresse e-mail. Aucun achat n’a été lancé.' };
    }

    const body: Record<string, unknown> = { productId: target.productId, quantity: target.quantity };
    if (product.requiresEmailActivation) {
      const email = String(customer?.email || '').trim().toLowerCase();
      if (!email) return { ...previousState, status: 'failed', error: 'Aucune adresse e-mail client ne permet de réaliser l’activation.' };
      if (target.quantity === 1) body.email = email;
      else body.emails = Array.from({ length: target.quantity }, () => email);
    }

    let response: Response;
    try {
      response = await request('/orders', dependencies.getApiKey(), {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(body),
      });
    } catch {
      return { ...previousState, status: 'retryable', attempt, idempotencyKey, error: 'La réponse du fournisseur est incertaine. Une nouvelle tentative réutilisera la clé d’idempotence.' };
    }

    const result = await responseJson(response);
    if (!response.ok) {
      if (response.status === 402) {
        return { ...previousState, status: 'insufficient_balance', attempt: attempt + 1, idempotencyKey, error: 'Le solde du fournisseur est insuffisant. Rechargez-le avant de réessayer.' };
      }
      if (response.status === 409) {
        return { ...previousState, status: 'failed', attempt, idempotencyKey, error: 'Le fournisseur indique que le produit est indisponible ou déjà traité.' };
      }
      const retryable = ![400, 401, 404].includes(response.status);
      return {
        ...previousState,
        status: retryable ? 'retryable' : 'failed',
        attempt: retryable ? attempt : attempt + 1,
        idempotencyKey,
        error: response.status === 429
          ? 'Le fournisseur limite temporairement les requêtes. Réessayez plus tard.'
          : 'La commande fournisseur n’a pas pu être créée. Vérifiez la configuration avant de réessayer.',
      };
    }

    const providerOrderId = typeof result.orderId === 'string' ? result.orderId : '';
    if (!providerOrderId) {
      return { ...previousState, status: 'retryable', attempt, idempotencyKey, error: 'La réponse fournisseur ne contient pas de référence de commande. Réessayez avec la même référence.' };
    }
    const externalStatus = String(result.status || '').toLowerCase();
    const keys = readKeys(result);
    if (externalStatus === 'delivered') {
      if (keys.length !== target.quantity) {
        return { ...previousState, orderId: providerOrderId, status: 'failed', attempt, idempotencyKey, externalStatus, keys, error: 'Le nombre d’accès livré ne correspond pas à la quantité commandée.' };
      }
      return { ...previousState, orderId: providerOrderId, status: 'success', attempt, idempotencyKey, externalStatus, keys, error: undefined };
    }
    if (externalStatus === 'failed') {
      return { ...previousState, orderId: providerOrderId, status: 'failed', attempt, idempotencyKey, externalStatus, error: 'La livraison a échoué chez le fournisseur.' };
    }
    return { ...previousState, orderId: providerOrderId, status: 'starting', attempt, idempotencyKey, externalStatus, keys: [] };
  }

  async function listProducts(): Promise<{ body: unknown; status: number }> {
    let response: Response;
    try {
      response = await request('/products', dependencies.getApiKey());
    } catch (error) {
      console.error('ProdSeller catalogue connection failed:', error instanceof Error ? error.message : 'Unknown error');
      return { body: { error: 'Connexion à ProdSeller impossible. Vérifiez la connexion du fournisseur puis réessayez.' }, status: 502 };
    }
    const result = await responseJson(response);
    if (!response.ok) {
      console.error('ProdSeller catalogue request returned HTTP status:', response.status);
      const message = response.status === 401
        ? 'ProdSeller refuse la clé API configurée. Vérifiez le secret PRODSELLER_API_KEY dans Supabase.'
        : response.status === 403
          ? 'La clé ProdSeller ne possède pas l’autorisation de consulter le catalogue.'
          : response.status === 404
            ? 'Le point d’accès du catalogue ProdSeller est introuvable. Vérifiez la configuration de l’API fournisseur.'
            : response.status === 429
              ? 'ProdSeller limite temporairement les requêtes. Patientez puis réessayez.'
              : response.status >= 500
                ? 'Le service ProdSeller rencontre une erreur temporaire. Réessayez dans quelques minutes.'
                : `ProdSeller a refusé la requête (HTTP ${response.status}).`;
      return { body: { error: message, providerStatus: response.status }, status: 502 };
    }
    if (!Array.isArray(result.products)) {
      console.error('ProdSeller catalogue response has an unexpected shape.');
      return {
        body: { error: 'La réponse du catalogue ProdSeller est inattendue. Vérifiez la compatibilité de l’API fournisseur.' },
        status: 502,
      };
    }
    return {
      status: 200,
      body: {
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
      },
    };
  }

  return {
    id: 'prodseller',
    isConfigured(target) {
      return dependencies.isConfigured() && (!target || Boolean(dependencies.getProductId(target)));
    },
    checkAvailability,
    loadProduct,
    createOrder,
    fetchOrderState,
    listProducts,
    normalize(state) {
      return {
        status: state.status,
        links: [],
        accessKeys: state.keys || [],
      };
    },
  };
}
