import type {
  ProviderAdapter,
  ProviderAvailability,
  ProviderOrderContext,
  ProviderOrderState,
  ProviderTarget,
} from './providerTypes.ts';

const API_URL = 'https://zfourstore.online/api/v1';

type ZFourStoreDependencies = {
  getApiKey(): string;
  getProductId(target: ProviderTarget): string;
  isConfigured(): boolean;
};

type ZFourStoreAdapter = ProviderAdapter & {
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

async function responseJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const value = await response.json();
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function getData(result: Record<string, unknown> | null) {
  return result?.data && typeof result.data === 'object'
    ? result.data as Record<string, unknown>
    : null;
}

function getItems(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

export function createZFourStoreAdapter(dependencies: ZFourStoreDependencies): ZFourStoreAdapter {
  async function listProducts(): Promise<{ body: unknown; status: number }> {
    let response: Response;
    try {
      response = await request('/products', dependencies.getApiKey(), {
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      console.error('Z FOUR STORE catalogue connection failed:', error instanceof Error ? error.message : 'Unknown error');
      return {
        body: { error: 'Connexion à Z FOUR STORE impossible. Vérifiez la connexion au fournisseur puis réessayez.' },
        status: 502,
      };
    }
    const result = await responseJson(response);
    if (!response.ok) {
      console.error('Z FOUR STORE catalogue request returned HTTP status:', response.status);
      const message = response.status === 401
        ? 'Z FOUR STORE refuse la clé API configurée. Vérifiez le secret ZFOURSTORE_API_KEY dans Supabase.'
        : response.status === 403
          ? 'La clé Z FOUR STORE ne possède pas l’autorisation de consulter le catalogue.'
          : response.status === 404
            ? 'Le point d’accès du catalogue Z FOUR STORE est introuvable.'
            : response.status === 429
              ? 'Z FOUR STORE limite temporairement les requêtes. Patientez puis réessayez.'
              : response.status >= 500
                ? 'Le service Z FOUR STORE rencontre une erreur temporaire. Réessayez dans quelques minutes.'
                : `Z FOUR STORE a refusé la requête (HTTP ${response.status}).`;
      return { body: { error: message, providerStatus: response.status }, status: 502 };
    }
    if (result?.success !== true || !Array.isArray(result.data)) {
      console.error('Z FOUR STORE catalogue response has an unexpected shape.');
      return {
        body: { error: 'La réponse du catalogue Z FOUR STORE est inattendue. Vérifiez la compatibilité de son API.' },
        status: 502,
      };
    }
    return {
      status: 200,
      body: {
        products: result.data.map((entry: unknown) => {
          const product = entry && typeof entry === 'object'
            ? entry as Record<string, unknown>
            : {};
          const stock = Number(product.stock);
          return {
            id: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            stock: Number.isFinite(stock) ? stock : null,
            inStock: Number.isFinite(stock) ? stock > 0 : null,
          };
        }),
      },
    };
  }

  async function loadProduct(target: ProviderTarget) {
    let response: Response;
    try {
      response = await request('/products', dependencies.getApiKey(), {
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      return null;
    }
    const result = await responseJson(response);
    if (!response.ok || result?.success !== true || !Array.isArray(result.data)) {
      if (!response.ok) console.error('Z FOUR STORE product lookup returned HTTP status:', response.status);
      return null;
    }
    const product = result.data.find((entry: unknown) =>
      entry && typeof entry === 'object'
      && (entry as Record<string, unknown>).id === target.productId,
    ) as Record<string, unknown> | undefined;
    if (!product) return null;
    const stock = typeof product.stock === 'number' ? product.stock : Number(product.stock);
    return {
      ...product,
      stock: Number.isFinite(stock) ? stock : null,
      inStock: Number.isFinite(stock) && stock > 0,
      requiresEmailActivation: false,
    };
  }

  async function checkAvailability(target: ProviderTarget): Promise<ProviderAvailability> {
    if (!dependencies.isConfigured() || !target.productId) {
      return { available: false, stock: null, balanceOk: null, message: 'La configuration Z FOUR STORE est incomplète.' };
    }
    const [product, balanceResponse] = await Promise.all([
      loadProduct(target),
      request('/balance', dependencies.getApiKey(), { signal: AbortSignal.timeout(8000) }).catch(() => null),
    ]);
    if (!product) {
      return { available: false, stock: null, balanceOk: null, message: 'La disponibilité Z FOUR STORE n’a pas pu être vérifiée.' };
    }
    const stock = typeof product.stock === 'number' ? product.stock : null;
    const price = Number(product.price);
    let balanceOk: boolean | null = null;
    if (balanceResponse?.ok) {
      const balanceResult = await responseJson(balanceResponse);
      const balanceData = getData(balanceResult);
      const balance = Number(balanceData?.balance);
      if (Number.isFinite(balance) && Number.isFinite(price)) {
        balanceOk = balance >= price * target.quantity;
      }
    } else if (balanceResponse) {
      console.error('Z FOUR STORE balance check returned HTTP status:', balanceResponse.status);
    }
    return {
      available: product.inStock === true,
      stock,
      balanceOk,
    };
  }

  async function fetchOrderState(
    state: ProviderOrderState,
    target: ProviderTarget,
  ): Promise<ProviderOrderState> {
    if (!state.orderId) return state;
    let response: Response;
    try {
      response = await request(`/order/${encodeURIComponent(state.orderId)}`, dependencies.getApiKey(), {
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      return { ...state, status: 'retryable', error: 'La vérification Z FOUR STORE est momentanément indisponible.' };
    }
    const result = await responseJson(response);
    const data = getData(result);
    if (!response.ok || result?.success !== true || !data) {
      return { ...state, status: 'retryable', error: 'La vérification Z FOUR STORE est momentanément indisponible.' };
    }
    const externalStatus = String(data.status || '').toUpperCase();
    const keys = getItems(data.items);
    if (externalStatus === 'COMPLETED') {
      if (keys.length !== target.quantity || Number(data.quantity) !== target.quantity) {
        return { ...state, status: 'failed', externalStatus, keys, error: 'Le nombre d’accès livré ne correspond pas à la quantité commandée.' };
      }
      return { ...state, status: 'success', externalStatus, keys, error: undefined };
    }
    if (['FAILED', 'CANCELLED', 'CANCELED'].includes(externalStatus)) {
      return { ...state, status: 'failed', externalStatus, error: 'La livraison a échoué chez Z FOUR STORE.' };
    }
    return { ...state, status: 'starting', externalStatus, keys: [], error: undefined };
  }

  async function createOrder(
    target: ProviderTarget,
    _idempotencyKey: string,
    context: ProviderOrderContext,
  ): Promise<ProviderOrderState> {
    const { attempt, previousState } = context;
    let response: Response;
    try {
      response = await request('/order', dependencies.getApiKey(), {
        method: 'POST',
        body: JSON.stringify({ productId: target.productId, quantity: target.quantity }),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      return {
        ...previousState,
        status: 'failed',
        attempt,
        error: 'Réponse Z FOUR STORE incertaine. Aucun nouvel achat automatique ne sera lancé; vérifiez la commande auprès du fournisseur avant toute action.',
      };
    }

    const result = await responseJson(response);
    const data = getData(result);
    if (!response.ok || result?.success !== true || !data) {
      if (response.status === 402) {
        return { ...previousState, status: 'insufficient_balance', attempt: attempt + 1, error: 'Le solde Z FOUR STORE est insuffisant. Rechargez-le avant de réessayer.' };
      }
      if (response.status === 429) {
        return { ...previousState, status: 'retryable', attempt, error: 'Z FOUR STORE limite temporairement les requêtes. Réessayez plus tard.' };
      }
      console.error('Z FOUR STORE order creation returned HTTP status:', response.status);
      return {
        ...previousState,
        status: 'failed',
        attempt,
        error: 'La commande Z FOUR STORE n’a pas pu être confirmée. Vérifiez son état auprès du fournisseur avant toute nouvelle action.',
      };
    }

    const orderId = typeof data.orderId === 'string'
      ? data.orderId
      : typeof data.id === 'string'
        ? data.id
        : '';
    if (!orderId) {
      return {
        ...previousState,
        status: 'failed',
        attempt,
        error: 'Z FOUR STORE n’a pas renvoyé de référence de commande. Aucun nouvel achat automatique ne sera lancé; vérifiez la commande auprès du fournisseur.',
      };
    }
    if (
      (typeof data.productId === 'string' && data.productId !== target.productId)
      || (Number.isInteger(Number(data.quantity)) && Number(data.quantity) !== target.quantity)
    ) {
      return {
        ...previousState,
        orderId,
        status: 'failed',
        attempt,
        error: 'Z FOUR STORE a confirmé une commande avec un produit ou une quantité inattendus. Contacte le support avant toute action.',
      };
    }
    const keys = getItems(data.items);
    if (keys.length === target.quantity) {
      return { ...previousState, orderId, status: 'success', attempt, externalStatus: 'COMPLETED', keys };
    }
    return { ...previousState, orderId, status: 'starting', attempt, externalStatus: 'PENDING', keys: [] };
  }

  return {
    id: 'zfourstore',
    listProducts,
    isConfigured(target) {
      return dependencies.isConfigured() && (!target || Boolean(dependencies.getProductId(target)));
    },
    checkAvailability,
    loadProduct,
    createOrder,
    fetchOrderState,
    normalize(state) {
      return { status: state.status, links: [], accessKeys: state.keys || [] };
    },
  };
}
