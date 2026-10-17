import { supabase } from './supabase';

const PRODUCT_FIELDS = 'id, name, slug, description, tagline, highlights, category_id, badge, cta_label, regular_price, promo_price, status, featured, sort_order, avatar, gradient, logo_url, image_url, poster_ratio, delivery_type, download_filename, download_size';
const OPTIONAL_PRODUCT_FIELDS = ['cta_label', 'regular_price', 'promo_price'];
const BASE_PRODUCT_FIELDS = PRODUCT_FIELDS
  .split(', ')
  .filter((field) => !OPTIONAL_PRODUCT_FIELDS.includes(field));
const PLAN_FIELDS = 'id, product_id, slug, label, price, old_price, currency, sort_order, active';

export function hideActivationProvider(value) {
  return typeof value === 'string'
    ? value.replace(/pixverify(?:\.shop)?/gi, 'service d’activation')
    : value;
}

function attachShopData(products, plans, categories) {
  const plansByProduct = new Map();
  const productsById = new Map((products || []).map((product) => [product.id, product]));
  for (const plan of plans || []) {
    const productPlans = plansByProduct.get(plan.product_id) || [];
    const product = productsById.get(plan.product_id);
    productPlans.push({
      ...plan,
      price: Number(product.promo_price ?? plan.price),
      old_price: plan.old_price === null ? null : Number(plan.old_price),
    });
    plansByProduct.set(plan.product_id, productPlans);
  }

  const categoryById = new Map((categories || []).map((category) => [category.id, category]));
  return (products || []).map((product) => {
    const category = categoryById.get(product.category_id);
    return {
      ...product,
      regular_price: product.regular_price == null ? null : Number(product.regular_price),
      promo_price: product.promo_price == null ? null : Number(product.promo_price),
      name: hideActivationProvider(product.name),
      description: hideActivationProvider(product.description),
      tagline: hideActivationProvider(product.tagline),
      badge: hideActivationProvider(product.badge),
      category: category?.slug || '',
      categoryLabel: hideActivationProvider(category?.label || 'Autres'),
      plans: (plansByProduct.get(product.id) || []).sort((left, right) => left.sort_order - right.sort_order),
      highlights: Array.isArray(product.highlights)
        ? product.highlights.map(hideActivationProvider)
        : [],
    };
  });
}

export async function listShopCatalog({ includeInactive = false } = {}) {
  async function fetchProducts(fields) {
    let query = supabase
      .from('products')
      .select(fields)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (!includeInactive) query = query.eq('status', 'active');
    return query;
  }

  async function fetchProductsWithAvailableFields() {
    const availableOptionalFields = [...OPTIONAL_PRODUCT_FIELDS];
    const missingOptionalFields = [];
    let result;

    while (true) {
      result = await fetchProducts([...BASE_PRODUCT_FIELDS, ...availableOptionalFields].join(', '));
      if (!result.error || result.error.code !== '42703') break;

      const missingField = availableOptionalFields.find((field) => (
        result.error.message.includes(`products.${field}`)
      ));
      if (!missingField) break;

      availableOptionalFields.splice(availableOptionalFields.indexOf(missingField), 1);
      missingOptionalFields.push(missingField);
    }

    if (missingOptionalFields.length) {
      console.warn(
        `Colonnes boutique absentes (${missingOptionalFields.join(', ')}). Applique les migrations correspondantes; des valeurs par défaut sont utilisées.`,
      );
    }
    return result;
  }

  const [categoriesResult, productsResult] = await Promise.all([
    supabase.from('categories').select('id, scope, slug, label, sort_order').eq('scope', 'boutique').order('sort_order'),
    fetchProductsWithAvailableFields(),
  ]);

  const error = categoriesResult.error || productsResult.error;
  if (error) return { data: null, error };

  const products = productsResult.data || [];
  const productIds = products.map((product) => product.id);
  let plans = [];
  if (productIds.length) {
    const plansResult = await supabase
      .from('product_plans')
      .select(PLAN_FIELDS)
      .in('product_id', productIds)
      .order('sort_order');
    if (plansResult.error) return { data: null, error: plansResult.error };
    const geminiProductIds = new Set(
      products.filter((product) => product.slug === 'gemini-pro').map((product) => product.id)
    );
    plans = (plansResult.data || []).filter((plan) =>
      includeInactive || plan.active || geminiProductIds.has(plan.product_id)
    );
  }

  return {
    data: {
      categories: categoriesResult.data || [],
      products: attachShopData(products, plans, categoriesResult.data),
    },
    error: null,
  };
}

export async function getShopContent() {
  const { data, error } = await supabase.from('settings').select('key, value').like('key', 'shop_%');
  if (error) return { data: null, error };
  return {
    data: Object.fromEntries((data || []).map((row) => [row.key, hideActivationProvider(row.value)])),
    error: null,
  };
}

export function saveShopContent(content) {
  const rows = Object.entries(content).map(([key, value]) => ({
    key,
    value: value.trim(),
  }));
  return supabase.from('settings').upsert(rows, { onConflict: 'key' });
}

export async function listShopAdminData() {
  const [catalog, content, deliveryResult] = await Promise.all([
    listShopCatalog({ includeInactive: true }),
    getShopContent(),
    supabase.from('product_deliveries').select('product_id, access_url'),
  ]);
  const error = catalog.error || content.error || deliveryResult.error;
  const deliveryByProduct = new Map(
    (deliveryResult.data || []).map((delivery) => [delivery.product_id, delivery.access_url]),
  );
  return {
    data: catalog.data && content.data && deliveryResult.data
      ? {
        ...catalog.data,
        products: catalog.data.products.map((product) => ({
          ...product,
          access_url: deliveryByProduct.get(product.id) || '',
        })),
        content: content.data,
      }
      : null,
    error,
  };
}

export async function saveShopProduct(product, plans) {
  const id = product.id || crypto.randomUUID();
  const productRow = {
    id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    tagline: product.tagline,
    highlights: product.highlights,
    category_id: product.category_id,
    badge: product.badge,
    cta_label: product.cta_label || 'Acheter maintenant',
    regular_price: product.regular_price === '' ? null : Number(product.regular_price),
    promo_price: product.promo_price === '' ? null : Number(product.promo_price),
    status: product.status,
    featured: product.featured,
    sort_order: Number(product.sort_order) || 999,
    avatar: product.avatar,
    gradient: product.gradient,
    logo_url: product.logo_url,
    image_url: product.image_url,
    poster_ratio: product.poster_ratio || '4/3',
    delivery_type: product.delivery_type || 'activate',
    download_filename: product.download_filename || null,
    download_size: product.download_size || null,
    updated_at: new Date().toISOString(),
  };
  if (!product.id) productRow.created_at = productRow.updated_at;

  const { error: productError } = await supabase.from('products').upsert(productRow, { onConflict: 'id' });
  if (productError) {
    if (productError.code === '42703' && OPTIONAL_PRODUCT_FIELDS.some((field) => productError.message.includes(field))) {
      const missingField = OPTIONAL_PRODUCT_FIELDS.find((field) => productError.message.includes(field));
      const migration = missingField === 'cta_label' ? '015_shop_product_cta_label.sql' : '016_shop_product_prices.sql';
      return {
        error: new Error(`Applique la migration supabase/migrations/${migration} pour enregistrer ces champs produit.`),
      };
    }
    return { error: productError };
  }

  const deliveryUrl = product.access_url?.trim();
  const deliveryResult = deliveryUrl
    ? await supabase.from('product_deliveries').upsert({
      product_id: id,
      access_url: deliveryUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'product_id' })
    : await supabase.from('product_deliveries').delete().eq('product_id', id);
  if (deliveryResult.error) return { error: deliveryResult.error, partial: true };

  const planRows = plans.map((plan, index) => ({
    id: plan.id || crypto.randomUUID(),
    product_id: id,
    slug: plan.slug,
    label: plan.label.trim(),
    price: Number(product.promo_price ?? plan.price),
    old_price: null,
    currency: plan.currency || 'XOF',
    sort_order: index * 10 + 10,
    active: Boolean(plan.active),
  }));

  if (planRows.length) {
    const { error: plansError } = await supabase.from('product_plans').upsert(planRows, { onConflict: 'id' });
    if (plansError) return { error: plansError, partial: true };
  }

  const activePlanIds = planRows.filter((plan) => plan.active).map((plan) => plan.id);
  let removedPlansQuery = supabase
    .from('product_plans')
    .update({ active: false })
    .eq('product_id', id)
    .eq('active', true);
  if (activePlanIds.length) {
    removedPlansQuery = removedPlansQuery.not('id', 'in', `(${activePlanIds.join(',')})`);
  }
  const { error: removedPlansError } = await removedPlansQuery;
  if (removedPlansError) return { error: removedPlansError, partial: true };

  return { error: null, id };
}

export function archiveShopProduct(id) {
  return supabase.from('products').update({ status: 'archived', featured: false }).eq('id', id);
}

export function createShopCategory(category) {
  return supabase.from('categories').insert({
    id: crypto.randomUUID(),
    scope: 'boutique',
    ...category,
  });
}

export function updateShopCategory(id, label, slug) {
  return supabase.from('categories').update({ label, slug }).eq('id', id);
}

export function deleteShopCategory(id) {
  return supabase.from('categories').delete().eq('id', id);
}

export async function listShopOrders() {
  return supabase
    .from('orders')
    .select(`
      id, ref, status, payment_method, payment_status, total, note, created_at,
      currency, payment_provider, payment_transaction_id, payment_verified_at, fulfillment_status,
      customers ( name, contact, email ),
      order_items ( id, product_name, plan_label, unit_price, qty, line_total )
    `)
    .order('created_at', { ascending: false });
}

export function updateShopOrderFulfillment(id, fulfillmentStatus) {
  return supabase
    .from('orders')
    .update({ fulfillment_status: fulfillmentStatus, status: fulfillmentStatus })
    .eq('id', id);
}

export function createShopCheckout({ customer, items, note }) {
  return supabase.functions.invoke('checkout-shop', { body: { customer, items, note } });
}

export function createSasPayCheckout({ orderId }) {
  return supabase.functions.invoke('saspay-checkout', { body: { orderId } });
}

export function verifySasPayPayment({ orderId, sessionId }) {
  return supabase.functions.invoke('verify-saspay-payment', {
    body: { orderId, sessionId },
  });
}

export function getBuyerAccount() {
  return supabase.functions.invoke('shop-account', { body: {} });
}

export function deleteBuyerAccount() {
  return supabase.functions.invoke('delete-buyer-account');
}

async function getFunctionErrorMessage(error) {
  const response = error?.context;
  if (response && typeof response.clone === 'function') {
    try {
      const body = await response.clone().json();
      if (typeof body?.error === 'string' && body.error.trim()) return body.error;
      if (typeof body?.message === 'string' && body.message.trim()) return body.message;
    } catch (parseError) {
      console.warn('La réponse d’erreur de la fonction boutique n’est pas au format JSON :', parseError);
    }
  }
  return error?.message || 'La vérification du paiement a échoué.';
}

export async function verifyShopPayment({ orderId, transactionId }) {
  const result = await supabase.functions.invoke('verify-kkiapay-payment', {
    body: { orderId, transactionId },
  });
  if (result.error) {
    return {
      ...result,
      error: new Error(await getFunctionErrorMessage(result.error)),
    };
  }
  return result;
}

export function getShopOrderDeliveries({ orderId, orderRef }) {
  return supabase.functions.invoke('shop-order-delivery', {
    body: { orderId, orderRef },
  });
}
