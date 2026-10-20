export function isApiDelivery(product: { delivery_type?: unknown } | null | undefined) {
  return product?.delivery_type === 'api';
}

const API_DELIVERY_PRODUCTS: Record<string, { key: 'gemini_18m' | 'canva_pro'; planSlug?: string }> = {
  'gemini-pro': { key: 'gemini_18m', planSlug: '18mois' },
  'canva-pro': { key: 'canva_pro' },
};

export function getProdSellerTargetKey(product: { slug?: unknown; delivery_type?: unknown }, planSlug?: string) {
  if (!isApiDelivery(product) || typeof product.slug !== 'string') return null;
  const target = API_DELIVERY_PRODUCTS[product.slug];
  if (!target || (target.planSlug && target.planSlug !== planSlug)) return null;
  return target.key;
}

export function getProdSellerProductKey(product: { slug?: unknown; delivery_type?: unknown }) {
  if (!isApiDelivery(product) || typeof product.slug !== 'string') return null;
  return API_DELIVERY_PRODUCTS[product.slug]?.key || null;
}
