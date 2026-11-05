import { getSasPayConfig, getServiceClient, jsonResponse } from '../_shared/shop.ts';

function firstValue(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Connectez-vous pour vérifier le paiement.' }, 401);
    const client = getServiceClient();
    const { data: { user }, error: authError } = await client.auth.getUser(accessToken);
    if (authError || !user?.email || !user.email_confirmed_at) {
      return jsonResponse({ error: 'Votre session client est invalide ou non autorisée.' }, 401);
    }

    const { topupId } = await request.json();
    if (typeof topupId !== 'string') return jsonResponse({ error: 'Référence de recharge invalide.' }, 400);
    const { data: topup, error: topupError } = await client
      .from('smm_wallet_topups')
      .select('id, user_id, reference, amount_xof, status, payment_session_id, payment_transaction_id')
      .eq('id', topupId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (topupError) throw topupError;
    if (!topup) return jsonResponse({ error: 'Recharge introuvable.' }, 404);
    if (topup.status === 'confirmed') return jsonResponse({ verified: true, alreadyConfirmed: true });
    if (!topup.payment_session_id) return jsonResponse({ error: 'Session de paiement introuvable.' }, 409);

    const { apiBaseUrl, authorizationHeader } = getSasPayConfig();
    const response = await fetch(`${apiBaseUrl}/payments/${encodeURIComponent(topup.payment_session_id)}/verify/`, {
      headers: { Authorization: authorizationHeader },
    });
    const payload = await response.json();
    if (!response.ok) return jsonResponse({ error: 'Vérification SasPay impossible.' }, 502);
    const transaction = (payload.data && typeof payload.data === 'object')
      ? payload.data as Record<string, unknown>
      : payload as Record<string, unknown>;
    const status = String(transaction.transaction_status || transaction.status || '').toUpperCase();
    if (status !== 'SUCCESS' && status !== 'PAID') return jsonResponse({ verified: false });

    const nestedTransaction = transaction.data && typeof transaction.data === 'object'
      ? transaction.data as Record<string, unknown>
      : {};
    const amount = firstValue(transaction.amount, transaction.total, nestedTransaction.amount, nestedTransaction.total);
    if (amount === undefined || !Number.isFinite(Number(amount)) || Number(amount) !== Number(topup.amount_xof)) {
      return jsonResponse({ error: 'Le montant payé ne correspond pas à la recharge.' }, 409);
    }
    const currency = String(firstValue(transaction.currency, nestedTransaction.currency) || '').toUpperCase();
    if (currency !== 'XOF') return jsonResponse({ error: 'La devise du paiement est incorrecte.' }, 409);
    const transactionId = String(transaction.id || topup.payment_session_id);
    const { error: creditError } = await client.rpc('smm_credit_topup', {
      p_topup_id: topup.id,
      p_transaction_id: transactionId,
    });
    if (creditError) throw creditError;
    return jsonResponse({ verified: true });
  } catch (error) {
    console.error('Échec de vérification de recharge SMM :', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Vérification du paiement impossible.' }, 500);
  }
});
