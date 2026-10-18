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

async function createSignature(secret: string, signedPayload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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
    const signature = (request.headers.get('x-webhook-signature') || '').trim().toLowerCase();
    const timestamp = (request.headers.get('x-webhook-timestamp') || '').trim();
    const timestampSeconds = Number(timestamp);
    if (!signature) {
      return jsonResponse({ error: 'En-tête X-Webhook-Signature manquant.' }, 400);
    }
    if (!/^\d+$/.test(timestamp) || !Number.isSafeInteger(timestampSeconds)
      || Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > 300) {
      return jsonResponse({ error: 'Horodatage du webhook invalide ou expiré.' }, 400);
    }
    const expectedSignature = await createSignature(webhookSecret, `${timestamp}.${rawBody}`);
    if (!constantTimeEqual(signature, expectedSignature)) {
      return jsonResponse({ error: 'Signature du webhook invalide.' }, 401);
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const nested = (payload.data && typeof payload.data === 'object')
      ? payload.data as Record<string, unknown>
      : {};
    const event = String(payload.event || '').trim();
    const reference = String(firstValue(
      nested.reference,
      payload.reference,
      nested.order_ref,
      payload.order_ref,
    ) || '').trim();
    const sessionId = String(firstValue(
      nested.id,
      nested.session_id,
      nested.checkout_session_id,
      payload.session_id,
      payload.checkout_session_id,
      payload.id,
    ) || '').trim();
    if (event !== 'transaction.success' || (!reference && !sessionId)) {
      return jsonResponse({ error: 'Notification sans référence de commande.' }, 400);
    }

    const { apiBaseUrl, authorizationHeader } = getSasPayConfig();
    const client = getServiceClient();
    let orderQuery = client
      .from('orders')
      .select('id, ref, total, currency, payment_status, payment_transaction_id')
      .limit(1);
    orderQuery = reference ? orderQuery.eq('ref', reference) : orderQuery.eq('payment_transaction_id', sessionId);
    let { data: order, error: orderError } = await orderQuery.maybeSingle();
    if (orderError) throw orderError;
    if (!order && sessionId) {
      const verificationResponse = await fetch(
        `${apiBaseUrl}/payments/${encodeURIComponent(sessionId)}/verify/`,
        { headers: { Authorization: authorizationHeader } },
      );
      if (verificationResponse.ok) {
        const verificationPayload = await verificationResponse.json();
        const transaction = (verificationPayload.data && typeof verificationPayload.data === 'object')
          ? verificationPayload.data as Record<string, unknown>
          : verificationPayload as Record<string, unknown>;
        const description = String(transaction.description || '');
        const orderRef = description.match(/\bCC-[A-Z0-9]+\b/i)?.[0]
          || String(transaction.external_reference || transaction.reference || '').match(/\bCC-[A-Z0-9]+\b/i)?.[0];
        if (orderRef) {
          const orderLookup = await client
            .from('orders')
            .select('id, ref, total, currency, payment_status, payment_transaction_id')
            .eq('ref', orderRef.toUpperCase())
            .maybeSingle();
          order = orderLookup.data;
          orderError = orderLookup.error;
        }
      }
    }
    if (orderError) throw orderError;
    if (!order) return jsonResponse({ error: 'Commande introuvable.' }, 404);

    const transactionId = sessionId || order.payment_transaction_id;
    if (!transactionId) return jsonResponse({ error: 'Transaction SasPay absente.' }, 400);

    const response = await fetch(`${apiBaseUrl}/payments/${encodeURIComponent(transactionId)}/verify/`, {
      headers: { Authorization: authorizationHeader },
    });
    const verificationResponse = await response.json();
    if (!response.ok) return jsonResponse({ error: 'Vérification SasPay impossible.' }, 502);
    const statusPayload = (verificationResponse.data && typeof verificationResponse.data === 'object')
      ? verificationResponse.data as Record<string, unknown>
      : verificationResponse as Record<string, unknown>;
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

    if (order.payment_status === 'confirme') {
      if (order.payment_transaction_id !== transactionId && order.payment_transaction_id !== sessionId) {
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
