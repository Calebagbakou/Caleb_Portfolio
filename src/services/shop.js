import { supabase } from './supabase';

const PRODUCT_FIELDS = 'id, name, slug, description, tagline, highlights, category_id, badge, status, featured, sort_order, avatar, gradient, logo_url, image_url, access_url';
const PLAN_FIELDS = 'id, product_id, slug, label, price, old_price, currency, sort_order, active';

function attachShopData(products, plans, categories) {
  const plansByProduct = new Map();
  for (const plan of plans || []) {
    const productPlans = plansByProduct.get(plan.product_id) || [];
    productPlans.push({
      ...plan,
      price: Number(plan.price),
      old_price: plan.old_price === null ? null : Number(plan.old_price),
    });
    plansByProduct.set(plan.product_id, productPlans);
  }

  const categoryById = new Map((categories || []).map((category) => [category.id, category]));
  return (products || []).map((product) => {
    const category = categoryById.get(product.category_id);
    return {
      ...product,
      category: category?.slug || '',
      categoryLabel: category?.label || 'Autres',
      plans: (plansByProduct.get(product.id) || []).sort((left, right) => left.sort_order - right.sort_order),
      highlights: Array.isArray(product.highlights) ? product.highlights : [],
    };
  });
}

export async function listShopCatalog({ includeInactive = false } = {}) {
  let productQuery = supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (!includeInactive) productQuery = productQuery.eq('status', 'active');

  const [categoriesResult, productsResult] = await Promise.all([
    supabase.from('categories').select('id, scope, slug, label, sort_order').eq('scope', 'boutique').order('sort_order'),
    productQuery,
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
    data: Object.fromEntries((data || []).map((row) => [row.key, row.value])),
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
  const [catalog, content] = await Promise.all([
    listShopCatalog({ includeInactive: true }),
    getShopContent(),
  ]);
  return {
    data: catalog.data && content.data ? { ...catalog.data, content: content.data } : null,
    error: catalog.error || content.error,
  };
}

export async function saveShopProduct(product, plans) {
  const id = product.id || crypto.randomUUID();
  const productRow = {
    ...product,
    id,
    slug: product.slug,
    sort_order: Number(product.sort_order) || 999,
    updated_at: new Date().toISOString(),
  };
  if (!product.id) productRow.created_at = productRow.updated_at;

  const { error: productError } = await supabase.from('products').upsert(productRow, { onConflict: 'id' });
  if (productError) return { error: productError };

  const planRows = plans.map((plan, index) => ({
    id: plan.id || crypto.randomUUID(),
    product_id: id,
    slug: plan.slug,
    label: plan.label.trim(),
    price: Number(plan.price),
    old_price: plan.old_price === '' || plan.old_price === null ? null : Number(plan.old_price),
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

export function verifyShopPayment({ orderId, transactionId }) {
  return supabase.functions.invoke('verify-kkiapay-payment', {
    body: { orderId, transactionId },
  });
}
