import { getServiceClient, jsonResponse } from '../_shared/shop.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Session client manquante.' }, 401);

    const client = getServiceClient();
    const { data: { user }, error: authError } = await client.auth.getUser(accessToken);
    if (authError || !user?.id || !user.email) {
      return jsonResponse({ error: 'Session client invalide.' }, 401);
    }

    const anonymizedEmail = `deleted-${user.id}@invalid.local`;
    const { error: anonymizeError } = await client
      .from('customers')
      .update({
        name: 'Compte supprimé',
        contact: '',
        email: anonymizedEmail,
      })
      .eq('email', user.email.trim().toLowerCase());
    if (anonymizeError) throw anonymizeError;

    const { error: deleteError } = await client.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error('Échec de suppression du compte client :', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Suppression du compte impossible.' }, 500);
  }
});
