import {
  getPaymentClient,
  getServiceClient,
  isPaymentSuccessful,
  jsonResponse,
} from '../_shared/shop.ts';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  const webhookSecret = Deno.env.get('KKIAPAY_WEBHOOK_SECRET');
  if (!webhookSecret || request.headers.get('x-kkiapay-secret') !== webhookSecret) {
    return jsonResponse({ error: 'Signature du webhook invalide.' }, 401);
  }

  try {
    const payload = await request.json();
    const transactionId = String(payload.transactionId || '').trim();
    if (!transactionId) return jsonResponse({ error: 'Transaction sans identifiant.' }, 400);
    if (payload.isPaymentSucces !== true) return jsonResponse({ received: true, verified: false });

    const client = getServiceClient();
    const result = await getPaymentClient().verify(transactionId) as Record<string, unknown>;
    if (!isPaymentSuccessful(result)) {
      return jsonResponse({ error: 'La vérification KKiaPay a échoué.' }, 400);
    }

    const partnerId = String(result.partnerId || '');
    const { data: order, error: orderError } = await client
      .from('orders')
      .select('id, ref, total, payment_status, payment_transaction_id')
      .eq('ref', partnerId)
      .single();
    if (orderError) throw orderError;
    if (String(result.transactionId || '') !== transactionId
      || Math.round(Number(result.amount)) !== Math.round(Number(order.total))) {
      return jsonResponse({ error: 'Le montant ou la référence ne correspond pas à la commande.' }, 400);
    }

    if (order.payment_status === 'confirme') {
      if (order.payment_transaction_id !== transactionId) {
        return jsonResponse({ error: 'La commande est associée à une autre transaction.' }, 409);
      }
      return jsonResponse({ received: true, verified: true });
    }

    const { data: updated, error: updateError } = await client
      .from('orders')
      .update({
        payment_status: 'confirme',
        status: 'payee',
        payment_provider: 'kkiapay',
        payment_method: 'kkiapay',
        payment_transaction_id: transactionId,
        payment_verified_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('payment_status', 'non_confirme')
      .select('id')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) {
      const { data: latest, error: latestError } = await client
        .from('orders')
        .select('payment_status, payment_transaction_id')
        .eq('id', order.id)
        .single();
      if (latestError) throw latestError;
      if (latest.payment_status !== 'confirme' || latest.payment_transaction_id !== transactionId) {
        return jsonResponse({ error: 'La commande a changé pendant le traitement du webhook.' }, 409);
      }
    }

    return jsonResponse({ received: true, verified: true });
  } catch (error) {
    console.error('Échec du webhook KKiaPay :', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Traitement du webhook impossible.' }, 400);
  }
});
