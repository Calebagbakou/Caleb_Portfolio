import { getServiceClient, jsonResponse } from '../_shared/shop.ts';

const SASPAY_API_URL = 'https://api.saspay.me/api/v1';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    const apiKey = Deno.env.get('SAASPAY_API_KEY');
    if (!accessToken) return jsonResponse({ error: 'Connecte-toi avant de payer.' }, 401);
    if (!apiKey) return jsonResponse({ error: 'La clé SasPay test n’est pas configurée dans Supabase.' }, 503);

    const client = getServiceClient();
    const { data: { user }, error: authError } = await client.auth.getUser(accessToken);
    const { orderId } = await request.json();
    if (authError || !user?.email || typeof orderId !== 'string') {
      return jsonResponse({ error: 'Session ou commande invalide.' }, 401);
    }

    const { data: order, error: orderError } = await client
      .from('orders')
      .select('id, ref, total, currency, payment_status, customers!inner(email, name)')
      .eq('id', orderId)
      .eq('customers.email', user.email.trim().toLowerCase())
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return jsonResponse({ error: 'Cette commande est introuvable.' }, 404);
    if (order.payment_status === 'confirme') return jsonResponse({ error: 'Cette commande est déjà payée.' }, 409);

    const siteUrl = Deno.env.get('SITE_URL') || 'https://calebcreative.online';
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
    const response = await fetch(`${SASPAY_API_URL}/checkout-sessions/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Number(order.total).toFixed(2),
        currency: order.currency || 'XOF',
        description: `Commande ${order.ref}`,
        customer_email: user.email.trim().toLowerCase(),
        customer_name: customer?.name || user.email,
        return_url: `${siteUrl}/boutique/confirmation?order_id=${encodeURIComponent(order.id)}`,
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload?.data?.checkout_url || !payload?.data?.id) {
      console.error('Réponse SasPay invalide :', response.status, payload);
      return jsonResponse({ error: 'SasPay n’a pas pu créer la session de paiement.' }, 502);
    }

    const { error: updateError } = await client
      .from('orders')
      .update({
        payment_provider: 'saspay',
        payment_method: 'saspay',
        payment_transaction_id: payload.data.id,
      })
      .eq('id', order.id)
      .eq('payment_status', 'non_confirme');
    if (updateError) throw updateError;

    const separator = payload.data.checkout_url.includes('?') ? '&' : '?';
    const checkoutUrl = `${payload.data.checkout_url}${separator}saspay_session_id=${encodeURIComponent(payload.data.id)}&order_id=${encodeURIComponent(order.id)}`;
    return jsonResponse({ checkoutUrl, sessionId: payload.data.id });
  } catch (error) {
    console.error('Échec de création du checkout SasPay :', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Création du paiement impossible.' }, 500);
  }
});
