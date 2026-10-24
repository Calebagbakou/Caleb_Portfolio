export type ProviderId = 'prodseller' | 'zfourstore';

export type ProviderTarget = {
  key: string;
  productId: string;
  providerProductIds: Partial<Record<ProviderId, string>>;
  configuredProvider: ProviderId;
  shopProductId: string;
  name: string;
  quantity: number;
};

export type ProviderOrderState = {
  status: string;
  provider?: ProviderId;
  orderId?: string;
  attempt: number;
  idempotencyKey?: string;
  externalStatus?: string;
  keys?: string[];
  error?: string;
};

export type ProviderAvailability = {
  available: boolean;
  stock?: number | null;
  balanceOk?: boolean | null;
  message?: string;
};

export type ProviderOrderContext = {
  orderId: string;
  customer: { email?: string | null } | null;
  attempt: number;
  product?: Record<string, unknown>;
  previousState: ProviderOrderState;
};

export interface ProviderAdapter {
  readonly id: ProviderId;
  isConfigured(target?: ProviderTarget): boolean;
  checkAvailability(target: ProviderTarget): Promise<ProviderAvailability>;
  loadProduct(target: ProviderTarget): Promise<Record<string, unknown> | null>;
  createOrder(
    target: ProviderTarget,
    idempotencyKey: string,
    context: ProviderOrderContext,
  ): Promise<ProviderOrderState>;
  fetchOrderState(state: ProviderOrderState, target: ProviderTarget): Promise<ProviderOrderState>;
  normalize(state: ProviderOrderState): {
    status: string;
    links: string[];
    accessKeys: string[];
  };
}
