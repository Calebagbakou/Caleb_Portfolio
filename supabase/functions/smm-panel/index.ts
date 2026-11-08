import { getServiceClient, jsonResponse } from '../_shared/shop.ts';

const API_URL = 'https://smmturk.org/api/v2';

function providerKey() {
  const key = Deno.env.get('SMMTurk_API_KEY');
  if (!key) throw new Error('La clé SMMTurk_API_KEY n’est pas configurée dans Supabase.');
  return key;
}

function errorText(value: unknown) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const message = record.message || record.error || record.detail;
    if (typeof message === 'string' && message.trim()) {
      const code = typeof record.code === 'string' ? ` [${record.code}]` : '';
      const details = typeof record.details === 'string' && record.details.trim()
        ? ` — ${record.details}`
        : '';
      const hint = typeof record.hint === 'string' && record.hint.trim()
        ? ` Indication : ${record.hint}`
        : '';
      return `${message}${code}${details}${hint}`;
    }
  }
  return value instanceof Error ? value.message : 'Erreur inconnue.';
}

function apiError(payload: Record<string, unknown>) {
  return Boolean(payload.error) || String(payload.status || '').toLowerCase() === 'error';
}

function sanitizeProviderText(value: unknown, fallback: string, maxLength: number) {
  const text = String(value || fallback);
  let sanitized = '';
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 0) {
      sanitized += '\ufffd';
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        sanitized += text[index] + text[index + 1];
        index += 1;
      } else {
        sanitized += '\ufffd';
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      sanitized += '\ufffd';
    } else {
      sanitized += text[index];
    }
  }
  return sanitized.slice(0, maxLength);
}

function jsonHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

async function callProvider(payload: Record<string, unknown>, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ key: providerKey(), ...payload }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok || !data || typeof data !== 'object') {
      throw new Error(`SMMTurk a répondu avec HTTP ${response.status}.`);
    }
    if (Array.isArray(data)) return { data };
    return data as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

function mapStatus(value: unknown) {
  const status = String(value || '').toLowerCase();
  if (status.includes('complete')) return 'completed';
  if (status.includes('partial')) return 'partial';
  if (status.includes('cancel')) return 'canceled';
  if (status.includes('process')) return 'processing';
  return 'pending';
}

async function loadCurrentServices(serviceClient: ReturnType<typeof getServiceClient>) {
  const pageSize = 500;
  const services: Array<{ id: string; sell_rate_xof: number; active: boolean }> = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await serviceClient
      .from('smm_services')
      .select('id, sell_rate_xof, active')
      .order('id')
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    services.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return services;
}

Deno.serve(async (request) => {
  const cors = jsonHeaders();
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  let reservedOrderId: string | null = null;
  let action = '';
  let isAdmin = false;
  let operationStage = 'authentification';
  try {
    const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Connectez-vous pour accéder au panel social.' }, 401);

    const serviceClient = getServiceClient();
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(accessToken);
    if (authError || !user?.email || !user.email_confirmed_at) {
      return jsonResponse({ error: 'Votre session client est invalide ou non autorisée.' }, 401);
    }

    const body = await request.json() as Record<string, unknown>;
    action = String(body.action || '');
    operationStage = `action ${action || 'inconnue'}`;
    const { data: admins, error: adminError } = await serviceClient
      .from('admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    if (adminError) throw adminError;
    isAdmin = Boolean(admins);
    if (action === 'catalog') {
      const { data, error } = await serviceClient
        .from('smm_services')
        .select('id, name, type, category, provider_rate, sell_rate_xof, min_quantity, max_quantity, refill, cancel')
        .eq('active', true)
        .order('category')
        .order('id');
      if (error) throw error;
      return jsonResponse({
        services: data || [],
        orderApiConfirmed: Deno.env.get('SMMTurk_ADD_API_CONFIRMED') === 'true',
      });
    }

    if (action === 'admin_catalog') {
      if (!isAdmin) return jsonResponse({ error: 'Accès administrateur requis.' }, 403);
      const pageSize = 500;
      const services: Array<Record<string, unknown>> = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await serviceClient
          .from('smm_services')
          .select('id, name, type, category, provider_rate, sell_rate_xof, min_quantity, max_quantity, refill, cancel, active')
          .order('category')
          .order('id')
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        services.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }
      return jsonResponse({ services });
    }

    if (action === 'sync') {
      if (!isAdmin) return jsonResponse({ error: 'Accès administrateur requis.' }, 403);
      const syncStartedAt = Date.now();
      console.info('Synchronisation SMMTurk démarrée.');
      operationStage = 'appel à SMMTurk';
      const payload = await callProvider({ action: 'services' });
      if (apiError(payload)) return jsonResponse({ error: errorText(payload.error || payload.message) }, 502);
      const services = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.services) ? payload.services : null;
      if (!services || services.length === 0) {
        return jsonResponse({ error: 'Le catalogue SMMTurk est vide ou a un format inattendu ; les services existants sont conservés.' }, 502);
      }

      console.info(`Synchronisation du catalogue SMMTurk reçue (${services.length} entrées).`);
      operationStage = 'lecture des services existants';
      const currentServices = await loadCurrentServices(serviceClient);
      const existingById = new Map((currentServices || []).map((service) => [service.id, service]));
      const syncedIds = new Set<string>();
      let added = 0;
      const batchSize = 200;
      const syncedAt = new Date().toISOString();
      for (let offset = 0; offset < services.length; offset += batchSize) {
        operationStage = `validation et enregistrement des services ${offset + 1} à ${Math.min(offset + batchSize, services.length)}`;
        const batch = new Map<string, Record<string, unknown>>();
        for (const item of services.slice(offset, offset + batchSize)) {
          if (!item || typeof item !== 'object') {
            throw new Error('Une entrée du catalogue SMMTurk contient des données invalides.');
          }
          const service = item as Record<string, unknown>;
          const id = String(service.service ?? service.id ?? '').trim();
          const providerRate = Number(service.rate);
          const min = Number(service.min);
          const max = Number(service.max);
          if (!/^\d+$/.test(id) || !Number.isFinite(providerRate) || providerRate < 0
            || !Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 1 || max < min) {
            throw new Error('Une entrée du catalogue SMMTurk contient des données invalides.');
          }
          if (!existingById.has(id) && !syncedIds.has(id)) added += 1;
          syncedIds.add(id);
          batch.set(id, {
            id,
            name: sanitizeProviderText(service.name, `Service ${id}`, 250),
            type: sanitizeProviderText(service.type, '', 100),
            category: sanitizeProviderText(service.category, 'Autres', 150),
            provider_rate: providerRate,
            sell_rate_xof: existingById.get(id)?.sell_rate_xof ?? Math.ceil(providerRate * 4000),
            min_quantity: min,
            max_quantity: max,
            refill: service.refill === true || String(service.refill).toLowerCase() === 'true',
            cancel: service.cancel === true || String(service.cancel).toLowerCase() === 'true',
            active: existingById.get(id)?.active ?? false,
            updated_at: syncedAt,
          });
        }
        operationStage = `enregistrement du lot de services ${offset + 1} à ${Math.min(offset + batchSize, services.length)}`;
        const { error: upsertError } = await serviceClient
          .from('smm_services')
          .upsert([...batch.values()], { onConflict: 'id', ignoreDuplicates: false });
        if (upsertError) throw upsertError;
      }

      const staleIds = currentServices
        .filter((service) => !syncedIds.has(service.id))
        .map((service) => service.id);
      for (let offset = 0; offset < staleIds.length; offset += 100) {
        operationStage = 'désactivation des services retirés par SMMTurk';
        const staleBatch = staleIds.slice(offset, offset + 100);
        const { error: deactivateError } = await serviceClient
          .from('smm_services')
          .update({ active: false, updated_at: syncedAt })
          .in('id', staleBatch);
        if (deactivateError) throw deactivateError;
      }
      console.info(`Synchronisation SMMTurk terminée (${syncedIds.size} services, ${staleIds.length} retirés) en ${Date.now() - syncStartedAt} ms.`);
      return jsonResponse({
        synced: syncedIds.size,
        added,
      });
    }

    operationStage = `exécution de l’action ${action}`;
    if (action === 'set_active') {
      if (!isAdmin) return jsonResponse({ error: 'Accès administrateur requis.' }, 403);
      const serviceId = String(body.serviceId || '');
      if (!serviceId || typeof body.active !== 'boolean') {
        return jsonResponse({ error: 'Service ou état de publication invalide.' }, 400);
      }
      const { data, error } = await serviceClient
        .from('smm_services')
        .update({ active: body.active, updated_at: new Date().toISOString() })
        .eq('id', serviceId)
        .select('id, active')
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: 'Service introuvable.' }, 404);
      return jsonResponse({ service: data });
    }

    if (action === 'set_price') {
      if (!isAdmin) return jsonResponse({ error: 'Accès administrateur requis.' }, 403);
      const serviceId = String(body.serviceId || '');
      const sellRateXof = Number(body.sellRateXof);
      if (!serviceId || !Number.isSafeInteger(sellRateXof) || sellRateXof < 1) {
        return jsonResponse({ error: 'Le tarif doit être un nombre entier positif en FCFA.' }, 400);
      }
      const { data, error } = await serviceClient
        .from('smm_services')
        .update({ sell_rate_xof: sellRateXof, updated_at: new Date().toISOString() })
        .eq('id', serviceId)
        .select('id, sell_rate_xof')
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: 'Service introuvable.' }, 404);
      return jsonResponse({ service: data });
    }

    if (action === 'wallet') {
      const { data: wallet, error } = await serviceClient
        .from('smm_wallets')
        .select('balance_xof')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      const { data: transactions, error: transactionError } = await serviceClient
        .from('smm_wallet_transactions')
        .select('id, type, amount_xof, reference, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (transactionError) throw transactionError;
      return jsonResponse({ balanceXof: wallet?.balance_xof || 0, transactions: transactions || [] });
    }

    if (action === 'orders') {
      const { data, error } = await serviceClient
        .from('smm_orders')
        .select('id, service_id, service_name, link, quantity, charge_xof, status, remains, start_count, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return jsonResponse({ orders: data || [] });
    }

    if (action === 'place_order') {
      if (Deno.env.get('SMMTurk_ADD_API_CONFIRMED') !== 'true') {
        return jsonResponse({ error: 'Les commandes sont temporairement indisponibles pendant la finalisation de la configuration du service.' }, 503);
      }
      const serviceId = String(body.serviceId || '');
      const link = String(body.link || '').trim();
      const quantity = Number(body.quantity);
      let parsedLink: URL;
      try {
        parsedLink = new URL(link);
      } catch {
        return jsonResponse({ error: 'Saisissez un lien valide vers le contenu social.' }, 400);
      }
      if (!['https:', 'http:'].includes(parsedLink.protocol)
        || !Number.isSafeInteger(quantity) || quantity <= 0 || !serviceId) {
        return jsonResponse({ error: 'Le service, le lien ou la quantité est invalide.' }, 400);
      }
      if (link.length > 2048) return jsonResponse({ error: 'Le lien dépasse la longueur autorisée.' }, 400);
      const { data: reservedOrder, error: reserveError } = await serviceClient.rpc('smm_reserve_order', {
        p_user_id: user.id,
        p_service_id: serviceId,
        p_link: link,
        p_quantity: quantity,
      });
      if (reserveError) {
        const message = reserveError.message.includes('INSUFFICIENT_BALANCE')
          ? 'Votre portefeuille ne contient pas assez de fonds.'
          : reserveError.message.includes('INVALID_QUANTITY')
            ? 'La quantité ne respecte pas les limites de ce service.'
            : reserveError.message.includes('SERVICE_UNAVAILABLE')
              ? 'Ce service est momentanément indisponible.'
              : 'La commande n’a pas pu être préparée.';
        return jsonResponse({ error: message }, 400);
      }
      reservedOrderId = reservedOrder.id;

      let providerResponse: Record<string, unknown>;
      try {
        providerResponse = await callProvider({
          action: 'add',
          service: serviceId,
          link,
          quantity,
        });
      } catch (error) {
        await serviceClient.rpc('smm_finish_order', {
          p_order_id: reservedOrderId,
          p_status: 'submission_check',
          p_provider_order_id: null,
          p_error: 'Résultat fournisseur incertain ; vérification requise.',
        });
        console.error('Réponse SMMTurk incertaine après réservation de commande.');
        return jsonResponse({
          error: 'Le traitement de la commande est en cours de vérification. Le montant reste temporairement réservé.',
          orderId: reservedOrderId,
        }, 502);
      }
      if (apiError(providerResponse)) {
        const providerMessage = errorText(providerResponse.error || providerResponse.message);
        const { error: refundError } = await serviceClient.rpc('smm_refund_order', {
          p_order_id: reservedOrderId,
          p_reason: providerMessage,
        });
        if (refundError) throw refundError;
        reservedOrderId = null;
        console.error('Le service externe a refusé la commande :', providerMessage);
        return jsonResponse({ error: 'Le service n’a pas pu accepter la commande. Si un montant a été prélevé, il sera remboursé automatiquement.' }, 502);
      }
      const nestedOrder = providerResponse.data && typeof providerResponse.data === 'object'
        ? (providerResponse.data as Record<string, unknown>).order
        : null;
      const providerOrderId = String(providerResponse.order ?? nestedOrder ?? '').trim();
      if (!providerOrderId) {
        await serviceClient.rpc('smm_finish_order', {
          p_order_id: reservedOrderId,
          p_status: 'submission_check',
          p_provider_order_id: null,
          p_error: 'Réponse de commande sans identifiant fournisseur.',
        });
        return jsonResponse({
          error: 'La commande est en cours de vérification. Le montant reste temporairement réservé.',
          orderId: reservedOrderId,
        }, 502);
      }
      const { error: finishError } = await serviceClient.rpc('smm_finish_order', {
        p_order_id: reservedOrderId,
        p_status: 'pending',
        p_provider_order_id: providerOrderId,
        p_error: null,
      });
      if (finishError) throw finishError;
      const orderId = reservedOrderId;
      reservedOrderId = null;
      return jsonResponse({ orderId });
    }

    if (action === 'refresh_order') {
      const orderId = String(body.orderId || '');
      const { data: order, error } = await serviceClient
        .from('smm_orders')
        .select('id, user_id, provider_order_id, status')
        .eq('id', orderId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!order) return jsonResponse({ error: 'Commande introuvable.' }, 404);
      if (!order.provider_order_id) return jsonResponse({ order });
      const providerStatus = await callProvider({ action: 'status', order: order.provider_order_id });
      if (apiError(providerStatus)) {
        console.error('Impossible de récupérer le statut externe de la commande :', errorText(providerStatus.error || providerStatus.message));
        return jsonResponse({ error: 'Le statut de cette commande ne peut pas être actualisé pour le moment. Réessayez plus tard.' }, 502);
      }
      const status = mapStatus(providerStatus.status);
      const { error: updateError } = await serviceClient.rpc('smm_finish_order', {
        p_order_id: order.id,
        p_status: status,
        p_provider_order_id: order.provider_order_id,
        p_error: null,
      });
      if (updateError) throw updateError;
      return jsonResponse({ status });
    }

    return jsonResponse({ error: 'Action inconnue.' }, 400);
  } catch (error) {
    if (reservedOrderId) {
      try {
        await getServiceClient().rpc('smm_finish_order', {
          p_order_id: reservedOrderId,
          p_status: 'submission_check',
          p_provider_order_id: null,
          p_error: 'Résultat fournisseur incertain ; vérification requise.',
        });
      } catch (recoveryError) {
        console.error('Impossible de marquer la commande SMM comme à vérifier :', recoveryError);
      }
    }
    const message = errorText(error);
    console.error(`Échec de l’opération SMM (${operationStage}) :`, error);
    if (action === 'sync' && isAdmin) {
      return jsonResponse({ error: `Synchronisation interrompue pendant ${operationStage} : ${message}` }, 500);
    }
    const publicMessage = action === 'place_order'
      ? 'La commande n’a pas pu être traitée. Consultez vos commandes avant de réessayer.'
      : action === 'refresh_order'
        ? 'Le statut de cette commande ne peut pas être actualisé pour le moment.'
        : 'Une erreur est survenue pendant le chargement du panel. Réessayez dans quelques instants.';
    return jsonResponse({ error: publicMessage }, 500);
  }
});
