import type {
  ProviderAdapter,
  ProviderAvailability,
  ProviderOrderContext,
  ProviderOrderState,
  ProviderTarget,
} from './providerTypes.ts';

const API_URL = 'https://api.aihub.fashion/v1';

type AiHubDependencies = {
  getApiKey(): string;
  getProductId(target: ProviderTarget): string;
  isConfigured(): boolean;
};

type AiHubAdapter = ProviderAdapter & {
  listProducts(): Promise<{ body: unknown; status: number }>;
};

type AiHubProduct = Record<string, unknown> & {
  id: string | number;
  stock?: number | null;
  unlimited?: boolean;
  input_required?: string | null;
  price_usd?: number;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

async function responseJson(response: Response): Promise<Record<string, unknown> | unknown[] | null> {
  try {
    const value: unknown = await response.json();
    return asObject(value) || (Array.isArray(value) ? value : null);
  } catch {
    return null;
  }
}

function getErrorCode(result: Record<string, unknown> | unknown[] | null) {
  const error = asObject(asObject(result)?.error);
  return typeof error?.code === 'string' ? error.code : '';
}

function getOrder(result: Record<string, unknown> | unknown[] | null) {
  const body = asObject(result);
  return asObject(body?.order) || body;
}

function productName(product: Record<string, unknown>) {
  return String(product.name_en || product.name_ar || `AiHUB #${product.id}`);
}

function productDescription(product: Record<string, unknown>) {
  return String(product.description_en || product.description_ar || '');
}

function normalizeProduct(product: AiHubProduct) {
  const stockValue = product.stock;
  const stock = stockValue === null || stockValue === undefined
    ? null
    : Number.isFinite(Number(stockValue)) ? Number(stockValue) : null;
  const inputRequired = typeof product.input_required === 'string'
    ? product.input_required
    : null;
  return {
    ...product,
    id: String(product.id),
    name: productName(product),
    description: productDescription(product),
    price: Number.isFinite(Number(product.price_usd)) ? Number(product.price_usd) : null,
    currency: 'USD',
    stock,
    inStock: product.unlimited === true || stock === null || stock > 0,
    inputRequired,
    requiresEmailActivation: inputRequired === 'email',
  };
}

function isOutOfStock(product: Record<string, unknown>, quantity: number) {
  if (product.unlimited === true || product.stock === null || product.stock === undefined) return false;
  const stock = Number(product.stock);
  return Number.isFinite(stock) && stock < quantity;
}

function getTextItems(order: Record<string, unknown>) {
  return Array.isArray(order.items)
    ? order.items.flatMap((item) => {
      const entry = asObject(item);
      return entry?.type === 'text' && typeof entry.content === 'string' && entry.content.trim()
        ? [entry.content.trim()]
        : [];
    })
    : [];
}

function hasFileItems(order: Record<string, unknown>) {
  return Array.isArray(order.items)
    && order.items.some((item) => asObject(item)?.type === 'file');
}

function normalizeOrderState(
  state: ProviderOrderState,
  order: Record<string, unknown>,
  quantity: number,
): ProviderOrderState {
  const orderId = typeof order.id === 'string' ? order.id : state.orderId;
  const externalStatus = typeof order.status === 'string' ? order.status : '';
  const status = externalStatus.toLowerCase();
  const links = typeof order.activation_url === 'string' && order.activation_url.trim()
    ? [order.activation_url.trim()]
    : [];
  const keys = [...getTextItems(order), ...links];
  const fileDeliveryNote = hasFileItems(order)
    ? ' AiHUB envoie les éléments fichier sur Telegram; ils ne sont pas disponibles dans la boutique.'
    : '';

  if (status === 'delivered') {
    return {
      ...state,
      orderId,
      status: 'success',
      externalStatus,
      keys,
      links,
      error: fileDeliveryNote || (keys.length ? undefined : 'AiHUB a marqué la commande comme livrée sans accès web. Vérifiez le message Telegram ou contactez le support.'),
    };
  }
  if (status === 'refunded' || status === 'cancelled') {
    return {
      ...state,
      orderId,
      status: 'failed',
      externalStatus,
      keys: [],
      links: [],
      error: status === 'refunded'
        ? 'AiHUB a remboursé cette commande sur le portefeuille fournisseur. Vérifiez le remboursement du client avant toute nouvelle tentative.'
        : 'AiHUB a annulé cette commande. Aucun nouvel achat automatique ne sera lancé.',
    };
  }
  if (status === 'processing') {
    return {
      ...state,
      orderId,
      status: 'starting',
      externalStatus,
      keys: [],
      links: [],
      error: undefined,
    };
  }
  console.error('AiHUB returned an unknown order status:', externalStatus || '(missing)');
  return {
    ...state,
    orderId,
    status: 'starting',
    externalStatus,
    keys: [],
    links: [],
    error: `AiHUB n’a pas encore confirmé la livraison (${quantity} accès attendus).`,
  };
}

async function stableIdempotencyKey(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `caleb-${hash.slice(0, 48)}`;
}

export function createAiHubAdapter(dependencies: AiHubDependencies): AiHubAdapter {
  async function request(path: string, init: RequestInit = {}) {
    return fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'X-API-Key': dependencies.getApiKey(),
        ...(init.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
  }

  async function listProducts(): Promise<{ body: unknown; status: number }> {
    let response: Response;
    try {
      response = await request('/products', { signal: AbortSignal.timeout(8000) });
    } catch (error) {
      console.error('AiHUB catalogue connection failed:', error instanceof Error ? error.message : 'Unknown error');
      return {
        body: { error: 'Connexion à AiHUB impossible. Vérifiez la connexion au fournisseur puis réessayez.' },
        status: 502,
      };
    }
    const result = await responseJson(response);
    if (!response.ok) {
      console.error('AiHUB catalogue request returned HTTP status:', response.status);
      return {
        body: { error: response.status === 401
          ? 'AiHUB refuse la clé API. Vérifiez le secret AIHUB_API_KEY dans Supabase.'
          : `AiHUB a refusé la requête catalogue (HTTP ${response.status}).` },
        status: 502,
      };
    }
    if (!Array.isArray(result)) {
      console.error('AiHUB catalogue response has an unexpected shape.');
      return {
        body: { error: 'La réponse du catalogue AiHUB est inattendue.' },
        status: 502,
      };
    }
    return {
      status: 200,
      body: {
        products: result.flatMap((entry) => {
          const product = asObject(entry);
          return product && (typeof product.id === 'string' || typeof product.id === 'number')
            ? [normalizeProduct(product as AiHubProduct)]
            : [];
        }),
      },
    };
  }

  async function loadProduct(target: ProviderTarget) {
    let response: Response;
    try {
      response = await request(`/products/${encodeURIComponent(target.productId)}`, {
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      console.error('AiHUB product lookup failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
    const result = await responseJson(response);
    const product = asObject(result) as AiHubProduct | null;
    if (!response.ok || !product || String(product.id) !== target.productId) {
      if (!response.ok) console.error('AiHUB product lookup returned HTTP status:', response.status);
      return null;
    }
    const normalized = normalizeProduct(product);
    return {
      ...normalized,
      inStock: !isOutOfStock(product, target.quantity),
    };
  }

  async function checkAvailability(target: ProviderTarget): Promise<ProviderAvailability> {
    if (!dependencies.isConfigured() || !target.productId) {
      return { available: false, stock: null, balanceOk: null, message: 'La configuration AiHUB est incomplète.' };
    }
    const [product, accountResponse] = await Promise.all([
      loadProduct(target),
      request('/me', { signal: AbortSignal.timeout(8000) }).catch((error) => {
        console.error('AiHUB balance check failed:', error instanceof Error ? error.message : 'Unknown error');
        return null;
      }),
    ]);
    if (!product) {
      return { available: false, stock: null, balanceOk: null, message: 'La disponibilité AiHUB n’a pas pu être vérifiée.' };
    }

    let balanceOk: boolean | null = null;
    if (accountResponse?.ok) {
      const account = asObject(await responseJson(accountResponse));
      const balance = Number(account?.balance);
      const price = Number(product.price);
      if (Number.isFinite(balance) && Number.isFinite(price)) {
        balanceOk = balance >= price * target.quantity;
      }
    } else if (accountResponse) {
      console.error('AiHUB balance check returned HTTP status:', accountResponse.status);
    }

    const stock = typeof product.stock === 'number' ? product.stock : null;
    return {
      available: product.inStock === true && balanceOk !== false,
      stock,
      balanceOk,
      price: typeof product.price === 'number' ? product.price : null,
      currency: 'USD',
    };
  }

  async function createOrder(
    target: ProviderTarget,
    idempotencyKey: string,
    context: ProviderOrderContext,
  ): Promise<ProviderOrderState> {
    const { attempt, previousState, product } = context;
    const inputRequired = typeof product?.inputRequired === 'string' ? product.inputRequired : null;
    if (inputRequired) {
      return {
        ...previousState,
        status: 'failed',
        attempt,
        error: `Ce produit AiHUB exige une donnée client (${inputRequired}) qui n’est pas encore collectée par le formulaire. Aucun achat n’a été lancé.`,
      };
    }

    const key = await stableIdempotencyKey(idempotencyKey);
    let response: Response;
    try {
      response = await request('/buy', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({
          product_id: Number.isNaN(Number(target.productId)) ? target.productId : Number(target.productId),
          quantity: target.quantity,
        }),
        signal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      console.error('AiHUB purchase request failed:', error instanceof Error ? error.message : 'Unknown error');
      return {
        ...previousState,
        status: 'starting',
        attempt,
        idempotencyKey: key,
        error: 'La réponse AiHUB est incertaine. La commande sera vérifiée avec la même clé pour éviter un double achat.',
      };
    }

    const result = await responseJson(response);
    if (!response.ok) {
      const code = getErrorCode(result);
      if (response.status === 402 || code === 'insufficient_balance') {
        return {
          ...previousState,
          status: 'insufficient_balance',
          attempt: attempt + 1,
          error: 'Le solde AiHUB est insuffisant. Rechargez le portefeuille fournisseur avant de réessayer.',
        };
      }
      if (response.status === 409 && code === 'idempotency_conflict') {
        return {
          ...previousState,
          status: 'retryable',
          attempt,
          idempotencyKey: key,
          error: 'AiHUB confirme une requête identique en cours. Réessayez la vérification dans quelques instants.',
        };
      }
      if (response.status === 429) {
        return { ...previousState, status: 'retryable', attempt, idempotencyKey: key, error: 'AiHUB limite temporairement les requêtes. Réessayez plus tard.' };
      }
      if (code === 'out_of_stock' || code === 'product_unavailable') {
        return { ...previousState, status: 'failed', attempt, error: 'Le produit AiHUB est actuellement indisponible.' };
      }
      console.error('AiHUB purchase request returned HTTP status:', response.status, code || '(no error code)');
      return {
        ...previousState,
        status: response.status >= 500 ? 'starting' : 'failed',
        attempt,
        ...(response.status >= 500 ? { idempotencyKey: key } : {}),
        error: response.status >= 500
          ? 'AiHUB n’a pas confirmé le résultat. La vérification réutilisera la même clé pour éviter un double achat.'
          : 'AiHUB a refusé cette commande. Aucun nouvel achat automatique ne sera lancé.',
      };
    }

    const order = getOrder(result);
    if (!order || typeof order.id !== 'string') {
      console.error('AiHUB purchase response did not contain an order ID.');
      return {
        ...previousState,
        status: 'failed',
        attempt,
        error: 'AiHUB n’a pas renvoyé de référence de commande. Vérifiez auprès du support avant toute nouvelle action.',
      };
    }
    return normalizeOrderState({ ...previousState, attempt }, order, target.quantity);
  }

  async function fetchOrderState(
    state: ProviderOrderState,
    target: ProviderTarget,
  ): Promise<ProviderOrderState> {
    if (!state.orderId) return state;
    let response: Response;
    try {
      response = await request(`/orders/${encodeURIComponent(state.orderId)}`, {
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      console.error('AiHUB order status request failed:', error instanceof Error ? error.message : 'Unknown error');
      return { ...state, status: 'starting', error: 'La vérification AiHUB est momentanément indisponible.' };
    }
    const result = await responseJson(response);
    if (!response.ok) {
      console.error('AiHUB order status request returned HTTP status:', response.status);
      return { ...state, status: 'starting', error: 'La vérification AiHUB est momentanément indisponible.' };
    }
    const order = getOrder(result);
    if (!order || typeof order.id !== 'string') {
      console.error('AiHUB order status response has an unexpected shape.');
      return { ...state, status: 'starting', error: 'AiHUB n’a pas encore confirmé le statut de la commande.' };
    }
    return normalizeOrderState(state, order, target.quantity);
  }

  return {
    id: 'aihub',
    listProducts,
    isConfigured(target) {
      return dependencies.isConfigured() && (!target || Boolean(target.productId || dependencies.getProductId(target)));
    },
    checkAvailability,
    loadProduct,
    createOrder,
    fetchOrderState,
    normalize(state) {
      return { status: state.status, links: state.links || [], accessKeys: state.keys || [] };
    },
  };
}
