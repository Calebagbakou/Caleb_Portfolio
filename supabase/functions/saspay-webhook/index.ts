import { getSasPayConfig, getServiceClient, jsonResponse } from '../_shared/shop.ts';

function firstValue(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

async function createSignature(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getSignature(request: Request) {
  const value = request.headers.get('x-saspay-signature')
    || request.headers.get('x-webhook-signature')
    || request.headers.get('x-signature')
    || request.headers.get('signature')
    || '';
  return value.replace(/^sha256=/i, '').trim();
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const webhookSecret = Deno.env.get('SAASPAY_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('SAASPAY_WEBHOOK_SECRET est manquant.');
      return jsonResponse({ error: 'Webhook non configuré.' }, 503);
    }

    const rawBody = await request.text();
    const receivedSignature = getSignature(request);
    const expectedSignature = await createSignature(webhookSecret, rawBody);
    if (!receivedSignature || !constantTimeEqual(receivedSignature.toLowerCase(), expectedSignature)) {
      return jsonResponse({ error: 'Signature du webhook invalide.' }, 401);
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const nested = (payload.data && typeof payload.data === 'object')
      ? payload.data as Record<string, unknown>
      : {};
    const reference = String(firstValue(
      payload.reference,
      payload.order_ref,
      payload.order_reference,
      nested.reference,
      nested.order_ref,
      nested.order_reference,
    ) || '').trim();
    const sessionId = String(firstValue(
      payload.session_id,
      payload.checkout_session_id,
      payload.id,
      nested.session_id,
      nested.checkout_session_id,
      nested.id,
    ) || '').trim();
    if (!reference && !sessionId) {
      return jsonResponse({ error: 'Notification sans référence de commande.' }, 400);
    }

    const { apiBaseUrl, authorizationHeader } = getSasPayConfig();
    const client = getServiceClient();
    let orderQuery = client
      .from('orders')
      .select('id, ref, total, currency, payment_status, payment_transaction_id')
      .limit(1);
    orderQuery = reference ? orderQuery.eq('ref', reference) : orderQuery.eq('payment_transaction_id', sessionId);
    const { data: order, error: orderError } = await orderQuery.maybeSingle();
    if (orderError) throw orderError;
    if (!order) return jsonResponse({ error: 'Commande introuvable.' }, 404);

    if (sessionId && order.payment_transaction_id && order.payment_transaction_id !== sessionId) {
      return jsonResponse({ error: 'La session ne correspond pas à la commande.' }, 409);
    }
    const verifiedSessionId = sessionId || order.payment_transaction_id;
    if (!verifiedSessionId) return jsonResponse({ error: 'Session SasPay absente.' }, 400);

    const response = await fetch(`${apiBaseUrl}/checkout-sessions/${encodeURIComponent(verifiedSessionId)}/status/`, {
      headers: { Authorization: authorizationHeader },
    });
    const statusPayload = await response.json();
    if (!response.ok) return jsonResponse({ error: 'Vérification SasPay impossible.' }, 502);
    const status = String(statusPayload?.transaction_status || statusPayload?.status || '').toUpperCase();
    if (status !== 'SUCCESS' && status !== 'PAID') {
      return jsonResponse({ received: true, verified: false });
    }

    const providerAmount = firstValue(
      statusPayload.amount,
      statusPayload.data?.amount,
      statusPayload.total,
      statusPayload.data?.total,
    );
    if (providerAmount !== undefined && Number(providerAmount) !== Number(order.total)) {
      return jsonResponse({ error: 'Le montant ne correspond pas à la commande.' }, 409);
    }
    const providerCurrency = String(firstValue(
      statusPayload.currency,
      statusPayload.data?.currency,
    ) || '').toUpperCase();
    if (providerCurrency && providerCurrency !== String(order.currency || 'XOF').toUpperCase()) {
      return jsonResponse({ error: 'La devise ne correspond pas à la commande.' }, 409);
    }

    const transactionId = String(statusPayload.transaction_id || verifiedSessionId);
    if (order.payment_status === 'confirme') {
      if (order.payment_transaction_id !== transactionId && order.payment_transaction_id !== verifiedSessionId) {
        return jsonResponse({ error: 'La commande est associée à une autre transaction.' }, 409);
      }
      return jsonResponse({ received: true, verified: true });
    }

    const { data: updated, error: updateError } = await client
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
      .eq('payment_status', 'non_confirme')
      .select('id')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return jsonResponse({ error: 'La commande a changé pendant le traitement.' }, 409);
    return jsonResponse({ received: true, verified: true });
  } catch (error) {
    console.error('Échec du webhook SasPay :', error);
    return jsonResponse({ error: 'Traitement du webhook impossible.' }, 400);
  }
});
