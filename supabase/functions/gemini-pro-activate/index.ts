import { getServiceClient, jsonResponse } from '../_shared/shop.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const { code, email } = await request.json();
    if (!code || !email) {
      return jsonResponse({ error: 'Paramètres invalides (code et email requis).' }, 400);
    }

    // Call the pixverify.shop API to verify the code
    const pixverifyUrl = 'https://pixverify.shop/api/v1/verify';
    const pixverifyApiKey = Deno.env.get('PIXVERIFY_API_KEY');
    
    if (!pixverifyApiKey) {
      return jsonResponse({ error: 'Configuration serveur incomplète.' }, 500);
    }

    const pixverifyResponse = await fetch(pixverifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pixverifyApiKey}`,
      },
      body: JSON.stringify({ code, email }),
    });

    if (!pixverifyResponse.ok) {
      console.error('Pixverify error:', pixverifyResponse.status, await pixverifyResponse.text());
      return jsonResponse({ error: 'Impossible de vérifier le code. Contacte Caleb.' }, 400);
    }

    const pixverifyData = await pixverifyResponse.json();
    
    // Store activation in Supabase
    const client = getServiceClient();
    const { error: insertError } = await client
      .from('gemini_pro_activations')
      .insert({
        email,
        code,
        verified_at: new Date().toISOString(),
        pixverify_data: pixverifyData,
      });

    if (insertError) throw insertError;

    // Return access information
    return jsonResponse({
      message: 'Activation réussie ! Tu peux accéder à Gemini Pro.',
      access_info: {
        email,
        username: pixverifyData.username || email,
        password: pixverifyData.password || null,
        gemini_pro_url: pixverifyData.access_url || 'https://gemini.google.com',
      },
    });
  } catch (error) {
    console.error('Erreur lors de l\'activation Gemini Pro :', error);
    return jsonResponse(
      { error: 'Une erreur serveur s\'est produite.' },
      500
    );
  }
});
