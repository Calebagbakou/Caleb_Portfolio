import {
  getOrderReceipt,
  getSasPayConfig,
  getServiceClient,
  jsonResponse,
} from '../_shared/shop.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    const { apiBaseUrl, authorizationHeader } = getSasPayConfig();
    const { orderId, sessionId: requestedSessionId } = await request.json();
    if (!accessToken || typeof orderId !== 'string') {
      return jsonResponse({ error: 'Session de paiement invalide.' }, 400);
    }

    const client = getServiceClient();
    const { data: { user }, error: authError } = await client.auth.getUser(accessToken);
    if (authError || !user?.email) return jsonResponse({ error: 'Session client invalide.' }, 401);
    const { data: order, error: orderError } = await client
      .from('orders')
      .select('id, ref, total, currency, payment_status, payment_transaction_id, customers!inner(email)')
      .eq('id', orderId)
      .eq('customers.email', user.email.trim().toLowerCase())
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return jsonResponse({ error: 'Cette commande est introuvable.' }, 404);
    const sessionId = typeof requestedSessionId === 'string' && requestedSessionId
      ? requestedSessionId
      : order.payment_transaction_id;
    if (!sessionId) return jsonResponse({ error: 'Aucune session SasPay n’est associée à cette commande.' }, 400);

    const response = await fetch(`${apiBaseUrl}/checkout-sessions/${encodeURIComponent(sessionId)}/status/`, {
      headers: { Authorization: authorizationHeader },
    });
    const payload = await response.json();
    if (!response.ok) return jsonResponse({ error: 'SasPay n’a pas pu vérifier cette session.' }, 502);
    const status = String(payload?.transaction_status || payload?.status || '').toUpperCase();
    if (status !== 'SUCCESS' && status !== 'PAID') {
      return jsonResponse({
        verified: false,
        order: await getOrderReceipt(client, order.id),
        message: 'SasPay n’a pas encore confirmé ce paiement.',
      });
    }
    const transactionId = String(payload.transaction_id || sessionId);
    if (order.payment_transaction_id && order.payment_transaction_id !== sessionId) {
      return jsonResponse({ error: 'Cette commande est associée à une autre session SasPay.' }, 409);
    }

    if (order.payment_status !== 'confirme') {
      const { error: updateError } = await client
        .from('orders')
        .update({
          payment_status: 'confirme',
          status: 'payee',
          payment_provider: 'saspay',
          payment_method: 'saspay',
          payment_transaction_id: transactionId,
          payment_verified_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('payment_status', 'non_confirme');
      if (updateError) throw updateError;
    }
    return jsonResponse({ verified: true, order: await getOrderReceipt(client, order.id) });
  } catch (error) {
    console.error('Échec de vérification SasPay :', error);
    return jsonResponse({ error: 'Une erreur serveur empêche la vérification SasPay.' }, 500);
  }
});
