import { getSasPayConfig, getServiceClient, jsonResponse } from '../_shared/shop.ts';
import { isAllowedBuyerEmail } from '../_shared/buyer-email.ts';

function formatProviderError(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const nested = record.message || record.detail || record.error || record.code;
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
    try {
      return JSON.stringify(value);
    } catch {
      return 'Réponse d’erreur structurée reçue.';
    }
  }
  return '';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    const { apiBaseUrl, authorizationHeader, liveMode } = getSasPayConfig();
    if (!accessToken) return jsonResponse({ error: 'Connectez-vous avant de payer.' }, 401);

    const client = getServiceClient();
    const { data: { user }, error: authError } = await client.auth.getUser(accessToken);
    const { orderId } = await request.json();
    if (authError || !user?.email || !user.email_confirmed_at || typeof orderId !== 'string') {
      return jsonResponse({ error: 'Session ou commande invalide.' }, 401);
    }
    if (!isAllowedBuyerEmail(user.email)) {
      return jsonResponse({ error: 'Cette adresse n’est pas acceptée pour effectuer un paiement.' }, 403);
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
    const response = await fetch(`${apiBaseUrl}/checkout-sessions/`, {
      method: 'POST',
      headers: {
        Authorization: authorizationHeader,
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
      const providerMessage = formatProviderError(payload?.error)
        || formatProviderError(payload?.message)
        || formatProviderError(payload?.detail);
      return jsonResponse({
        error: providerMessage
          ? `SasPay a refusé le paiement : ${String(providerMessage).slice(0, 300)}`
          : `SasPay n’a pas pu créer la session de paiement (HTTP ${response.status}).`,
      }, 502);
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
    return jsonResponse({ checkoutUrl, sessionId: payload.data.id, mode: liveMode ? 'live' : 'test' });
  } catch (error) {
    console.error('Échec de création du checkout SasPay :', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Création du paiement impossible.' }, 500);
  }
});
