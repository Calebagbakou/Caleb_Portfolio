import { getServiceClient, jsonResponse } from '../_shared/shop.ts';

const PIXVERIFY_API_URL = 'https://pixverify.shop/api/v1';

function getApiKey() {
  const apiKey = Deno.env.get('PIXVERIFY_API_KEY');
  if (!apiKey) throw new Error('La variable PIXVERIFY_API_KEY n’est pas configurée.');
  return apiKey;
}

function normalizeCategoryName(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';
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

  const { data: orderItems, error: itemsError } = await client
    .from('order_items')
    .select('product_id, plan_id, qty')
    .eq('order_id', order.id);
  if (itemsError) throw itemsError;

  const productIds = [...new Set((orderItems || []).map((item: { product_id: string }) => item.product_id))];
  if (!productIds.length) {
    return { error: 'Cette commande ne contient aucun produit Gemini Pro 18 mois.', status: 403 as const };
  }

  const { data: geminiProducts, error: productsError } = await client
    .from('products')
    .select('id')
    .in('id', productIds)
    .eq('slug', 'gemini-pro');
  if (productsError) throw productsError;

  const geminiProductIds = new Set((geminiProducts || []).map((product: { id: string }) => product.id));
  const geminiItems = (orderItems || []).filter(
    (item: { product_id: string }) => geminiProductIds.has(item.product_id),
  );
  const planIds = [...new Set(geminiItems.map((item: { plan_id: string }) => item.plan_id))];
  const { data: plans, error: plansError } = planIds.length
    ? await client.from('product_plans').select('id, slug').in('id', planIds)
    : { data: [], error: null };
  if (plansError) throw plansError;

  const eligiblePlanIds = new Set(
    (plans || [])
      .filter((plan: { slug: string }) => plan.slug === '18mois')
      .map((plan: { id: string }) => plan.id),
  );
  const eligibleItems = geminiItems.filter(
    (item: { plan_id: string }) => eligiblePlanIds.has(item.plan_id),
  );
  if (!eligibleItems.length) {
    return { error: 'L’activation PixVerify est disponible uniquement pour la formule Gemini Pro 18 mois.', status: 403 as const };
  }

  return {
    order,
    quantity: eligibleItems.reduce((sum: number, item: { qty: number }) => sum + Number(item.qty), 0),
  };
}

async function readPixverifyError(response: Response) {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body);
    const error = parsed?.error;
    const code = typeof error?.code === 'string' ? error.code : '';
    const message = typeof error?.message === 'string'
      ? error.message
      : typeof error === 'string'
        ? error
      : typeof parsed?.message === 'string'
        ? parsed.message
        : '';
    return { code, message: message.trim().slice(0, 240) };
  } catch {
    return { code: '', message: '' };
  }
}

function getActivationLinks(credentials: unknown) {
  if (!Array.isArray(credentials) || credentials.length === 0) return [];

  return credentials.map((credential) => {
    const item = typeof credential === 'object' && credential !== null
      ? credential as Record<string, unknown>
      : null;
    const rawValue = typeof credential === 'string'
      ? credential.trim()
      : typeof item?.activation_link === 'string'
        ? item.activation_link.trim()
        : typeof item?.link === 'string'
          ? item.link.trim()
          : '';
    const value = rawValue.match(/https:\/\/[^\s]+/i)?.[0].replace(/[),.;]+$/, '') || '';
    if (!value) return null;

    try {
      const url = new URL(value);
      const isGoogleLink = url.hostname === 'g.co'
        || url.hostname === 'google.com'
        || url.hostname.endsWith('.google.com');
      return url.protocol === 'https:' && isGoogleLink ? url.href : null;
    } catch {
      return null;
    }
  }).filter((link): link is string => Boolean(link));
}

function activationResponse(record: { status: string; result_url: string | null; pixverify_data: unknown }) {
  const data = record.pixverify_data && typeof record.pixverify_data === 'object'
    ? record.pixverify_data as { links?: unknown }
    : {};
  const links = Array.isArray(data.links)
    ? data.links.filter((link): link is string => typeof link === 'string')
    : record.result_url
      ? [record.result_url]
      : [];
  return { status: record.status, links };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : 'invalid';
    console.log('PixVerify Gemini link request received.', { action });

    if (action === 'categories') {
      const categoryResponse = await pixverifyRequest('/shop/categories', getApiKey());
      if (!categoryResponse.ok) {
        console.warn('PixVerify category lookup rejected:', { status: categoryResponse.status });
        return jsonResponse({ error: `PixVerify a refusé le catalogue (HTTP ${categoryResponse.status}).` }, 502);
      }
      const categoryResult = await categoryResponse.json();
      if (categoryResult.success !== true || !Array.isArray(categoryResult.categories)) {
        console.error('PixVerify returned an unexpected shop category response.');
        return jsonResponse({ error: 'Réponse inattendue du catalogue PixVerify.' }, 502);
      }
      const categories = categoryResult.categories.map((category: Record<string, unknown>) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        price_per_unit: category.price_per_unit,
        discounted_price: category.discounted_price,
        stock: category.stock,
      }));
      return jsonResponse({ categories });
    }

    const client = getServiceClient();
    const orderResult = await getPaidGeminiOrder(client, body.order_id, body.order_ref);
    if ('error' in orderResult) {
      console.warn('PixVerify request rejected:', { action, status: orderResult.status, reason: orderResult.error });
      return jsonResponse({ error: orderResult.error }, orderResult.status);
    }
    const { order, quantity } = orderResult;

    const { data: existing, error: existingError } = await client
      .from('gemini_pro_activations')
      .select('id, generation_id, status, result_url, pixverify_data')
      .eq('order_id', order.id)
      .maybeSingle();
    if (existingError) throw existingError;

    if (action === 'status') {
      return jsonResponse(existing ? activationResponse(existing) : { status: 'not_started', links: [] });
    }

    if (action !== 'deliver' && action !== 'retry') {
      return jsonResponse({ error: 'Action invalide.' }, 400);
    }

    if (existing?.status === 'success') return jsonResponse(activationResponse(existing));
    if (['insufficient_balance', 'retryable'].includes(existing?.status) && action !== 'retry') {
      return jsonResponse({
        ...activationResponse(existing),
        error: existing.status === 'insufficient_balance'
          ? 'Solde PixVerify insuffisant. Recharge ton solde API, puis utilise le bouton Réessayer.'
          : 'La demande peut être retentée sans risque de double achat.',
        retryable: true,
      });
    }
    if (existing?.status === 'starting') {
      return jsonResponse({ status: 'starting', links: [] });
    }
    if (existing && !['insufficient_balance', 'retryable'].includes(existing.status)) {
      return jsonResponse({
        ...activationResponse(existing),
        error: 'La demande PixVerify a déjà été traitée pour cette commande. Contacte le support si le lien n’apparaît pas.',
      }, 409);
    }
    if (action === 'retry' && !['insufficient_balance', 'retryable'].includes(existing?.status)) {
      return jsonResponse({ error: 'Aucune demande réessayable pour cette commande.' }, 409);
    }

    const apiKey = getApiKey();
    let activationId = existing?.id as string | undefined;
    if (existing) {
      const { data: claimed, error: resetError } = await client
        .from('gemini_pro_activations')
        .update({ status: 'starting', result_url: null, pixverify_data: null })
        .eq('id', existing.id)
        .in('status', ['insufficient_balance', 'retryable'])
        .select('id')
        .maybeSingle();
      if (resetError) throw resetError;
      if (!claimed) return jsonResponse({ status: 'starting', links: [] });
    } else {
      const { data: activation, error: insertError } = await client
        .from('gemini_pro_activations')
        .insert({ order_id: order.id, status: 'starting' })
        .select('id')
        .single();
      if (insertError) {
        if (insertError.code === '23505') {
          return jsonResponse({ status: 'starting', links: [] });
        }
        throw insertError;
      }
      activationId = activation.id;
    }

    let categoryResponse: Response;
    try {
      categoryResponse = await pixverifyRequest('/shop/categories', apiKey);
    } catch (error) {
      console.error('PixVerify category request failed:', error instanceof Error ? error.message : 'Unknown error');
      const { error: updateError } = await client
        .from('gemini_pro_activations')
        .update({ status: 'retryable' })
        .eq('id', activationId);
      if (updateError) throw updateError;
      return jsonResponse({
        status: 'retryable',
        retryable: true,
        error: 'Connexion à PixVerify impossible. La demande n’a pas été relancée automatiquement.',
      }, 502);
    }
    if (!categoryResponse.ok) {
      console.error('PixVerify category request failed with HTTP status:', categoryResponse.status);
      const { error: updateError } = await client
        .from('gemini_pro_activations')
        .update({ status: 'retryable' })
        .eq('id', activationId);
      if (updateError) throw updateError;
      return jsonResponse({
        status: 'retryable',
        retryable: true,
        error: `PixVerify a refusé l’accès au catalogue (HTTP ${categoryResponse.status}).`,
      }, 502);
    }

    const categoryResult = await categoryResponse.json();
    const categories = Array.isArray(categoryResult?.categories) ? categoryResult.categories : [];
    const matches = categories.filter((category: { name?: unknown }) => {
      const name = normalizeCategoryName(category.name);
      return name.includes('18 months')
        && name.includes('gemini ai pro')
        && name.includes('activation link');
    });
    const categoryId = matches.length === 1 ? Number(matches[0].id) : NaN;
    if (categoryResult.success !== true || !Number.isSafeInteger(categoryId) || categoryId <= 0) {
      const { error: updateError } = await client
        .from('gemini_pro_activations')
        .update({ status: 'retryable' })
        .eq('id', activationId);
      if (updateError) throw updateError;
      console.error('PixVerify Gemini 18-month activation-link category was not uniquely identified.');
      return jsonResponse({
        status: 'retryable',
        retryable: true,
        error: matches.length > 1
          ? 'PixVerify renvoie plusieurs catégories Gemini AI Pro de 18 mois. Contacte le support.'
          : 'Le produit « Gemini AI Pro · 18 Months · Activation Link » est introuvable dans le catalogue PixVerify.',
      }, 502);
    }

    let purchaseResponse: Response;
    try {
      purchaseResponse = await pixverifyRequest('/shop/buy', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId, quantity }),
      });
    } catch (error) {
      console.error('PixVerify purchase request ended without a response:', error instanceof Error ? error.message : 'Unknown error');
      return jsonResponse({
        error: 'La connexion a été interrompue pendant la génération. Ne relance pas la demande tout de suite; vérifie PixVerify pour éviter un achat en double.',
      }, 502);
    }

    if (!purchaseResponse.ok) {
      const { code, message } = await readPixverifyError(purchaseResponse);
      console.warn('PixVerify shop purchase rejected:', { status: purchaseResponse.status, code });
      if (purchaseResponse.status === 402 || code === 'insufficient_topup_balance') {
        const { error: updateError } = await client
          .from('gemini_pro_activations')
          .update({ status: 'insufficient_balance' })
          .eq('id', activationId);
        if (updateError) throw updateError;
        return jsonResponse({
          status: 'insufficient_balance',
          error: message || 'Solde PixVerify insuffisant. Recharge ton solde API, puis réessaie.',
        }, 402);
      }

      const { error: updateError } = await client
        .from('gemini_pro_activations')
        .update({ status: 'failed' })
        .eq('id', activationId);
      if (updateError) throw updateError;
      return jsonResponse({
        status: 'failed',
        error: message || `PixVerify a refusé la génération du lien (HTTP ${purchaseResponse.status}).`,
      }, 502);
    }

    const purchase = await purchaseResponse.json();
    const links = getActivationLinks(purchase.credentials);
    if (purchase.success !== true || links.length !== quantity) {
      console.error('PixVerify purchase response did not contain the expected activation links.', {
        expected: quantity,
        received: links.length,
      });
      const { error: updateError } = await client
        .from('gemini_pro_activations')
        .update({ status: 'failed' })
        .eq('id', activationId);
      if (updateError) throw updateError;
      return jsonResponse({
        status: 'failed',
        error: 'PixVerify a accepté la demande, mais sa réponse ne contient pas le nombre attendu de liens Google One. Contacte le support avant de réessayer.',
      }, 502);
    }

    const { error: updateError } = await client
      .from('gemini_pro_activations')
      .update({
        status: 'success',
        result_url: links[0],
        pixverify_data: { links },
      })
      .eq('id', activationId);
    if (updateError) throw updateError;

    return jsonResponse({ status: 'success', links });
  } catch (error) {
    console.error('Erreur de génération du lien PixVerify:', error instanceof Error ? error.message : 'Unknown error');
    return jsonResponse({ error: 'Erreur serveur lors de la génération du lien PixVerify.' }, 500);
  }
});
