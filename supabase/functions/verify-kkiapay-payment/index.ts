import {
  getOrderReceipt,
  getPaymentClient,
  getServiceClient,
  isPaymentSuccessful,
  jsonResponse,
} from '../_shared/shop.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const body = await request.json();
    const orderId = body?.orderId;
    const transactionId = body?.transactionId;
    if (typeof orderId !== 'string' || typeof transactionId !== 'string' || !transactionId.trim()) {
      return jsonResponse({ error: 'Référence de commande ou transaction invalide.' }, 400);
    }

    const client = getServiceClient();
    const { data: order, error: orderError } = await client
      .from('orders')
      .select('id, ref, total, currency, payment_status, payment_transaction_id')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) throw new Error(`Lecture de la commande impossible : ${orderError.message}`);
    if (!order) return jsonResponse({ error: 'Cette commande est introuvable.' }, 404);

    const paymentClient = getPaymentClient();
    const result = await paymentClient.verify(transactionId.trim()) as Record<string, unknown>;
    if (!isPaymentSuccessful(result)) {
      return jsonResponse({ verified: false, message: 'KKiaPay ne confirme pas cette transaction.' }, 200);
    }
    if (String(result.transactionId || '') !== transactionId.trim()) {
      return jsonResponse({ error: 'La référence de transaction renvoyée par KKiaPay ne correspond pas.' }, 400);
    }
    if (String(result.partnerId || '') !== String(order.ref)) {
      return jsonResponse({ error: 'La référence de commande renvoyée par KKiaPay ne correspond pas.' }, 400);
    }
    const paidAmount = Number(result.amount);
    const orderAmount = Number(order.total);
    if (!Number.isFinite(paidAmount) || !Number.isFinite(orderAmount)
      || Math.round(paidAmount) !== Math.round(orderAmount)) {
      return jsonResponse({ error: 'Le montant confirmé par KKiaPay ne correspond pas au total de la commande.' }, 400);
    }

    if (order.payment_status === 'confirme') {
      if (order.payment_transaction_id !== transactionId.trim()) {
        return jsonResponse({ error: 'Cette commande est déjà associée à une autre transaction.' }, 409);
      }
      return jsonResponse({ verified: true, order: await getOrderReceipt(client, order.id) });
    }

    const verifiedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await client
      .from('orders')
      .update({
        payment_status: 'confirme',
        status: 'payee',
        payment_provider: 'kkiapay',
        payment_method: 'kkiapay',
        payment_transaction_id: transactionId.trim(),
        payment_verified_at: verifiedAt,
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
      if (latest.payment_status !== 'confirme' || latest.payment_transaction_id !== transactionId.trim()) {
        return jsonResponse({ error: 'La commande a changé pendant la vérification du paiement.' }, 409);
      }
    }

    return jsonResponse({ verified: true, order: await getOrderReceipt(client, order.id) });
  } catch (error) {
    console.error('Échec de vérification KKiaPay :', error);
    return jsonResponse({ error: 'Une erreur serveur empêche la vérification du paiement. La commande reste en attente.' }, 500);
  }
});
