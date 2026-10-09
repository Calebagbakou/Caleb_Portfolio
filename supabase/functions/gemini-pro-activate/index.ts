import { getServiceClient, jsonResponse } from '../_shared/shop.ts';

const PIXVERIFY_API_URL = 'https://pixverify.shop/api/v1';

function getApiKey() {
  const apiKey = Deno.env.get('PIXVERIFY_API_KEY');
  if (!apiKey) throw new Error('La variable PIXVERIFY_API_KEY n’est pas configurée.');
  return apiKey;
}

async function pixverifyRequest(path: string, apiKey: string, init?: RequestInit) {
  return fetch(`${PIXVERIFY_API_URL}${path}`, {
    ...init,
    headers: {
      'X-API-Key': apiKey,
      ...(init?.headers || {}),
    },
  });
}

async function getPaidGeminiOrder(client: ReturnType<typeof getServiceClient>, orderId: unknown, orderRef: unknown) {
  if (typeof orderId !== 'string' || typeof orderRef !== 'string') {
    return { error: 'Commande invalide.', status: 400 as const };
  }

  const { data: order, error: orderError } = await client
    .from('orders')
    .select('id, ref, payment_status')
    .eq('id', orderId)
    .eq('ref', orderRef)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) return { error: 'Commande introuvable.', status: 404 as const };
  if (order.payment_status !== 'confirme') {
    return { error: 'Le paiement de cette commande n’est pas confirmé.', status: 403 as const };
  }

  const { data: items, error: itemsError } = await client
    .from('order_items')
    .select('product_id')
    .eq('order_id', order.id);
  if (itemsError) throw itemsError;

  const productIds = [...new Set((items || []).map((item: { product_id: string }) => item.product_id))];
  if (!productIds.length) return { error: 'Cette commande ne contient aucun produit Gemini Pro.', status: 403 as const };

  const { data: geminiProducts, error: productsError } = await client
    .from('products')
    .select('id')
    .in('id', productIds)
    .eq('slug', 'gemini-pro');
  if (productsError) throw productsError;
  if (!geminiProducts?.length) {
    return { error: 'Cette commande ne contient aucun produit Gemini Pro.', status: 403 as const };
  }

  return { order };
}

async function readPixverifyError(response: Response) {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body);
    const message = [parsed.error, parsed.message, parsed.detail]
      .find((value) => typeof value === 'string' && value.trim());
    return message ? message.trim().slice(0, 240) : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  let activationId: string | null = null;
  try {
    const body = await request.json();
    console.log('Gemini PixVerify request received.', {
      action: typeof body?.action === 'string' ? body.action : 'invalid',
    });
    const client = getServiceClient();
    const orderResult = await getPaidGeminiOrder(client, body.order_id, body.order_ref);
    if ('error' in orderResult) {
      console.warn('Gemini PixVerify request rejected:', orderResult.status, orderResult.error);
      return jsonResponse({ error: orderResult.error }, orderResult.status);
    }
    const order = orderResult.order;

    if (body.action === 'start') {
      const { type, email, password, totp_secret: totpSecret } = body;
      const apiKey = getApiKey();
      const normalizedEmail = typeof email === 'string' ? email.trim() : '';
      const normalizedTotpSecret = typeof totpSecret === 'string'
        ? totpSecret.replace(/\s/g, '').toUpperCase()
        : '';

      if (
        !['vip', 'normal'].includes(type)
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
        || typeof password !== 'string'
        || !password
        || !/^[A-Z2-7]{32}$/.test(normalizedTotpSecret)
      ) {
        return jsonResponse({ error: 'Vérifie le type, l’adresse Gmail, le mot de passe et le secret TOTP (32 caractères Base32).' }, 400);
      }

      const { data: existing, error: existingError } = await client
        .from('gemini_pro_activations')
        .select('id, generation_id, status')
        .eq('order_id', order.id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        return jsonResponse({
          error: existing.generation_id
            ? 'Une vérification PixVerify a déjà été lancée pour cette commande.'
            : 'Une demande est déjà en cours de traitement pour cette commande.',
          generation_id: existing.generation_id,
          status: existing.status,
        }, 409);
      }

      const { data: activation, error: activationError } = await client
        .from('gemini_pro_activations')
        .insert({
          order_id: order.id,
          email: normalizedEmail,
          status: 'starting',
        })
        .select('id')
        .single();
      if (activationError) {
        if (activationError.code === '23505') {
          return jsonResponse({ error: 'Une vérification PixVerify a déjà été lancée pour cette commande.' }, 409);
        }
        throw activationError;
      }
      activationId = activation.id;

      let response: Response;
      try {
        response = await pixverifyRequest('/verifications/generate', apiKey, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            email: normalizedEmail,
            password,
            totp_secret: normalizedTotpSecret,
          }),
        });
      } catch (error) {
        console.error('PixVerify request failed before a response:', error instanceof Error ? error.message : 'Unknown error');
        return jsonResponse({
          error: 'La connexion à PixVerify a échoué. Pour éviter de lancer une demande en double, contacte le support avant de réessayer.',
        }, 502);
      }

      if (!response.ok) {
        const message = await readPixverifyError(response);
        console.warn('PixVerify rejected verification generation:', {
          status: response.status,
          message,
        });
        const { error: deleteError } = await client
          .from('gemini_pro_activations')
          .delete()
          .eq('id', activationId);
        if (deleteError) throw deleteError;
        activationId = null;
        return jsonResponse({
          error: message || (response.status === 402
            ? 'Solde PixVerify insuffisant. Recharge ton solde API puis réessaie.'
            : `PixVerify a refusé la demande (HTTP ${response.status}).`),
        }, response.status === 402 ? 402 : 400);
      }

      const result = await response.json();
      if (result.success !== true || result.generation_id === undefined) {
        console.error('PixVerify returned an unexpected generation response.');
        return jsonResponse({ error: 'Réponse inattendue de PixVerify. Contacte le support avant de réessayer.' }, 502);
      }

      const { error: updateError } = await client
        .from('gemini_pro_activations')
        .update({
          generation_id: String(result.generation_id),
          status: typeof result.status === 'string' ? result.status : 'pending',
        })
        .eq('id', activationId);
      if (updateError) throw updateError;

      return jsonResponse({
        generation_id: String(result.generation_id),
        status: typeof result.status === 'string' ? result.status : 'pending',
      }, 202);
    }

    if (body.action === 'status') {
      const { data: activation, error: activationError } = await client
        .from('gemini_pro_activations')
        .select('generation_id, status, result_url')
        .eq('order_id', order.id)
        .maybeSingle();
      if (activationError) throw activationError;
      if (!activation) return jsonResponse({ status: 'not_started' });
      if (!activation.generation_id) return jsonResponse({ status: 'starting' });
      if (activation.status === 'success') {
        return jsonResponse({
          generation_id: activation.generation_id,
          status: activation.status,
          result_url: activation.result_url,
        });
      }
      if (activation.status === 'failed') {
        return jsonResponse({ generation_id: activation.generation_id, status: activation.status });
      }

      const response = await pixverifyRequest(
        `/verifications/${encodeURIComponent(activation.generation_id)}`,
        getApiKey(),
      );
      if (!response.ok) {
        console.error('PixVerify verification status failed with status:', response.status);
        return jsonResponse({ error: 'Impossible de récupérer le statut auprès de PixVerify.' }, 502);
      }

      const result = await response.json();
      if (result.success !== true || typeof result.status !== 'string') {
        console.error('PixVerify returned an unexpected status response.');
        return jsonResponse({ error: 'Réponse de statut inattendue de PixVerify.' }, 502);
      }

      let resultUrl: string | null = null;
      if (result.status === 'success') {
        try {
          const parsedUrl = new URL(result.result_url);
          if (parsedUrl.protocol === 'https:' && parsedUrl.hostname === 'one.google.com') {
            resultUrl = parsedUrl.href;
          }
        } catch {
          resultUrl = null;
        }
        if (!resultUrl) {
          return jsonResponse({ error: 'PixVerify a terminé la vérification sans fournir de lien Google valide.' }, 502);
        }
      }

      const { error: updateError } = await client
        .from('gemini_pro_activations')
        .update({
          status: result.status,
          result_url: resultUrl,
        })
        .eq('order_id', order.id);
      if (updateError) throw updateError;

      return jsonResponse({
        generation_id: activation.generation_id,
        status: result.status,
        result_url: resultUrl,
        error_code: result.status === 'failed' ? result.error_code || null : null,
      });
    }

    return jsonResponse({ error: 'Action invalide.' }, 400);
  } catch (error) {
    console.error('Erreur de la fonction PixVerify:', error instanceof Error ? error.message : 'Erreur inconnue');
    return jsonResponse({ error: 'Erreur serveur lors de la communication avec PixVerify.' }, 500);
  }
});
