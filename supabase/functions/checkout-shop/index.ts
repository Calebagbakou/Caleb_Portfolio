import { getServiceClient, jsonResponse } from '../_shared/shop.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const body = await request.json();
    const customer = body?.customer;
    const items = body?.items;
    if (!customer || typeof customer !== 'object' || !Array.isArray(items)) {
      return jsonResponse({ error: 'Coordonnées client ou panier invalides.' }, 400);
    }

    const normalizedCustomer = {
      name: String(customer.name || '').trim().slice(0, 160),
      contact: String(customer.contact || '').trim().slice(0, 40),
      email: String(customer.email || '').trim().slice(0, 254),
    };
    if (!normalizedCustomer.name || !normalizedCustomer.contact) {
      return jsonResponse({ error: 'Le nom et le téléphone sont obligatoires.' }, 400);
    }
    if (normalizedCustomer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedCustomer.email)) {
      return jsonResponse({ error: 'Adresse e-mail invalide.' }, 400);
    }

    const client = getServiceClient();
    const productIds = [...new Set(items
      .map((item) => item?.product_id)
      .filter((id): id is string => typeof id === 'string'))];
    if (productIds.length) {
      const { data: products, error: productsError } = await client
        .from('products')
        .select('id, delivery_type')
        .in('id', productIds);
      if (productsError) throw productsError;
      if (products?.some((product) => product.delivery_type === 'download') && !normalizedCustomer.email) {
        return jsonResponse({ error: 'Une adresse e-mail est obligatoire pour recevoir le lien de téléchargement.' }, 400);
      }
    }

    const { data: order, error } = await client.rpc('create_shop_order', {
      p_customer: normalizedCustomer,
      p_items: items,
      p_note: String(body.note || '').trim().slice(0, 1000) || null,
    });
    if (error) throw error;
    if (!order?.id || !order?.ref || !Number.isFinite(Number(order.total))) {
      throw new Error('La base n’a pas retourné une commande valide.');
    }

    return jsonResponse({ order });
  } catch (error) {
    console.error('Échec de création de commande boutique :', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Création de commande impossible.' }, 400);
  }
});
