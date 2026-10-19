import { getServiceClient, jsonResponse } from '../_shared/shop.ts';
import { isAllowedBuyerEmail } from '../_shared/buyer-email.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
      return jsonResponse({ error: 'Connectez-vous avant de créer une commande.' }, 401);
    }

    const authClient = getServiceClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !user?.email || !user.email_confirmed_at) {
      return jsonResponse({ error: 'Une session avec une adresse e-mail confirmée est obligatoire.' }, 401);
    }
    if (!isAllowedBuyerEmail(user.email)) {
      return jsonResponse({ error: 'Cette adresse n’est pas acceptée. Utilisez une adresse personnelle d’un fournisseur courant.' }, 403);
    }

    const body = await request.json();
    const customer = body?.customer;
    const items = body?.items;
    if (!customer || typeof customer !== 'object' || !Array.isArray(items)) {
      return jsonResponse({ error: 'Coordonnées client ou panier invalides.' }, 400);
    }

    const normalizedCustomer = {
      name: String(customer.name || '').trim().slice(0, 160),
      contact: String(customer.contact || '').trim().slice(0, 40),
      email: user.email.trim().toLowerCase(),
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
      p_promo_code: typeof body.promo_code === 'string' ? body.promo_code.trim() : null,
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
