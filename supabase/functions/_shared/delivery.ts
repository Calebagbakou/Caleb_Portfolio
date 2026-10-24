export function isApiDelivery(product: { delivery_type?: unknown } | null | undefined) {
  return product?.delivery_type === 'api';
}

const LEGACY_TARGET_KEYS: Record<string, { key: string; planSlug?: string }> = {
  'gemini-pro': { key: 'gemini_18m', planSlug: '18mois' },
  'canva-pro': { key: 'canva_pro' },
  'duolingo-super': { key: 'duolingo_super_12m', planSlug: '12mois' },
};

export function getProdSellerTargetKey(
  product: { id?: unknown; slug?: unknown; delivery_type?: unknown },
  planSlug?: string,
) {
  if (!isApiDelivery(product)) return null;
  const legacy = typeof product.slug === 'string' ? LEGACY_TARGET_KEYS[product.slug] : null;
  if (legacy?.planSlug && legacy.planSlug !== planSlug) return null;
  if (legacy) return legacy.key;
  return typeof product.id === 'string' ? product.id : null;
}

export function getProdSellerProductKey(product: { slug?: unknown; delivery_type?: unknown }) {
  if (!isApiDelivery(product) || typeof product.slug !== 'string') return null;
  return LEGACY_TARGET_KEYS[product.slug]?.key || null;
}
