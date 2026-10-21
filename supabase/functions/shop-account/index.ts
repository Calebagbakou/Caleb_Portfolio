import { getServiceClient, jsonResponse } from '../_shared/shop.ts';

const OPTIONAL_DOWNLOAD_FIELDS = ['download_platform', 'download_instructions'];

function getMissingDownloadField(error: { code?: string; message?: string }, fields: string[]) {
  if (!['42703', 'PGRST204'].includes(error.code || '')) return null;
  return fields.find((field) => error.message?.includes(field)) || null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Connectez-vous pour accéder à votre compte.' }, 401);

    const client = getServiceClient();
    const { data: { user }, error: authError } = await client.auth.getUser(accessToken);
    if (authError || !user?.email || !user.email_confirmed_at) {
      return jsonResponse({ error: 'Une adresse e-mail confirmée est obligatoire.' }, 401);
    }

    const availableDownloadFields = [...OPTIONAL_DOWNLOAD_FIELDS];
    let result;
    while (true) {
      const optionalSelection = availableDownloadFields.length
        ? `, ${availableDownloadFields.join(', ')}`
        : '';
      result = await client
        .from('orders')
        .select(`
          id, ref, status, payment_status, payment_method, total, currency,
          promo_code, promo_discount, fulfillment_status, created_at,
          customers!inner ( name, contact, email ),
          order_items ( id, product_name, plan_label, qty, line_total,
            product_id, plan_id,
            products ( id, slug, delivery_type, download_filename, download_size, image_url, logo_url, avatar, gradient${optionalSelection} ) )
        `)
        .ilike('customers.email', user.email.trim())
        .order('created_at', { ascending: false });
      if (!result.error) break;
      const missingField = getMissingDownloadField(result.error, availableDownloadFields);
      if (!missingField) break;
      availableDownloadFields.splice(availableDownloadFields.indexOf(missingField), 1);
    }
    const { data: orders, error } = result;
    if (error) throw error;

    return jsonResponse({
      profile: { email: user.email, name: user.user_metadata?.full_name || user.user_metadata?.name || '' },
      orders: orders || [],
    });
  } catch (error) {
    console.error('Échec de chargement du compte client :', error);
    return jsonResponse({ error: 'Impossible de charger votre espace client.' }, 500);
  }
});
