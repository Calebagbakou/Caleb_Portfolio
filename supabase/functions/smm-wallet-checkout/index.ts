import { getSasPayConfig, getServiceClient, jsonResponse } from '../_shared/shop.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    if (Deno.env.get('SMMTurk_ADD_API_CONFIRMED') !== 'true') {
      return jsonResponse({ error: 'Les recharges restent désactivées jusqu’à validation du format de commande SMMTurk.' }, 503);
    }
    const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Connectez-vous avant de recharger le portefeuille.' }, 401);

    const client = getServiceClient();
    const { data: { user }, error: authError } = await client.auth.getUser(accessToken);
    if (authError || !user?.email || !user.email_confirmed_at) {
      return jsonResponse({ error: 'Votre session client est invalide ou non autorisée.' }, 401);
    }

    const { amountXof } = await request.json();
    const amount = Number(amountXof);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      return jsonResponse({ error: 'Saisissez un montant entier positif en FCFA.' }, 400);
    }

    const reference = `SMM-${crypto.randomUUID().replaceAll('-', '').toUpperCase()}`;
    const { data: topup, error: insertError } = await client
      .from('smm_wallet_topups')
      .insert({ user_id: user.id, reference, amount_xof: amount })
      .select('id')
      .single();
    if (insertError) throw insertError;

    const { apiBaseUrl, authorizationHeader, liveMode } = getSasPayConfig();
    const siteUrl = Deno.env.get('SITE_URL') || 'https://calebcreative.online';
    const response = await fetch(`${apiBaseUrl}/checkout-sessions/`, {
      method: 'POST',
      headers: { Authorization: authorizationHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount.toFixed(2),
        currency: 'XOF',
        description: `Recharge portefeuille ${reference}`,
        customer_email: user.email.trim().toLowerCase(),
        customer_name: user.user_metadata?.full_name || user.email,
        return_url: `${siteUrl}/smm?topup_id=${encodeURIComponent(topup.id)}`,
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload?.data?.checkout_url || !payload?.data?.id) {
      console.error('SasPay n’a pas créé la session de recharge.', response.status);
      return jsonResponse({ error: 'SasPay n’a pas pu créer la session de paiement. Réessayez.' }, 502);
    }

    const { error: updateError } = await client
      .from('smm_wallet_topups')
      .update({ payment_session_id: String(payload.data.id) })
      .eq('id', topup.id)
      .eq('user_id', user.id)
      .eq('status', 'pending');
    if (updateError) throw updateError;

    const separator = String(payload.data.checkout_url).includes('?') ? '&' : '?';
    return jsonResponse({
      checkoutUrl: `${payload.data.checkout_url}${separator}saspay_session_id=${encodeURIComponent(payload.data.id)}&topup_id=${encodeURIComponent(topup.id)}`,
      mode: liveMode ? 'live' : 'test',
    });
  } catch (error) {
    console.error('Échec de création de la recharge SasPay :', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Création du paiement impossible.' }, 500);
  }
});
