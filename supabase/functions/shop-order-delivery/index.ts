import { getServiceClient, jsonResponse } from '../_shared/shop.ts';

const TOKEN_TTL_HOURS = 24;

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashToken(token: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return toHex(new Uint8Array(bytes));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

async function sendDownloadEmail(email: string, name: string, downloads: Array<Record<string, string>>) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('SHOP_DOWNLOAD_FROM_EMAIL');
  if (!apiKey || !from) {
    return { sent: false, message: 'Envoi e-mail à configurer : RESEND_API_KEY et SHOP_DOWNLOAD_FROM_EMAIL sont requis.' };
  }

  const htmlDownloads = downloads.map((download) => `
    <li>
      <strong>${escapeHtml(download.name)}</strong> — ${escapeHtml(download.size)}
      <br><a href="${escapeHtml(download.url)}">Télécharger le fichier</a>
      <br><small>Ce lien expire dans ${TOKEN_TTL_HOURS} heures.</small>
    </li>
  `).join('');
  const textDownloads = downloads.map((download) =>
    `${download.name} (${download.size})\nTélécharger : ${download.url}\nExpiration : ${TOKEN_TTL_HOURS} heures.`,
  ).join('\n\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Tes fichiers Caleb Creative sont prêts',
      html: `<p>Bonjour ${escapeHtml(name)},</p><p>Ton paiement est confirmé. Voici tes liens de téléchargement temporaires :</p><ul>${htmlDownloads}</ul><p>Caleb Creative</p>`,
      text: `Bonjour ${name},\n\nTon paiement est confirmé. Voici tes liens de téléchargement temporaires :\n\n${textDownloads}\n\nCaleb Creative`,
    }),
  });

  if (!response.ok) {
    console.error('Échec Resend pour l’envoi du lien de téléchargement :', response.status);
    return { sent: false, message: 'Le lien est prêt, mais l’e-mail n’a pas pu être envoyé. Contacte Caleb.' };
  }
  return { sent: true, message: 'Le lien temporaire a aussi été envoyé par e-mail.' };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({}, 200);
  if (request.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const body = await request.json();
    const orderId = body?.orderId;
    const orderRef = body?.orderRef;
    if (typeof orderId !== 'string' || typeof orderRef !== 'string' || !orderRef.trim()) {
      return jsonResponse({ error: 'Référence de commande invalide.' }, 400);
    }

    const client = getServiceClient();
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return jsonResponse({ error: 'Connecte-toi pour accéder à ta livraison.' }, 401);
    const { data: { user }, error: authError } = await client.auth.getUser(accessToken);
    if (authError || !user?.email || !user.email_confirmed_at) {
      return jsonResponse({ error: 'Une adresse e-mail confirmée est obligatoire.' }, 401);
    }
    const { data: order, error: orderError } = await client
      .from('orders')
      .select(`
        id, ref, payment_status,
        customers ( name, email ),
        order_items ( product_id, product_name, plan_label, qty, line_total,
          products ( id, slug, delivery_type, download_filename, download_size ) )
      `)
      .eq('id', orderId)
      .eq('ref', orderRef.trim())
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return jsonResponse({ error: 'Cette commande est introuvable.' }, 404);
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
    if (customer?.email?.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      return jsonResponse({ error: 'Cette commande ne correspond pas à ton compte.' }, 403);
    }
    if (order.payment_status !== 'confirme') {
      return jsonResponse({ error: 'Le paiement doit être confirmé avant la livraison.' }, 409);
    }

    const items = (order.order_items || []).map((item: Record<string, unknown>) => {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      return { ...item, product };
    }).filter((item: Record<string, unknown>) =>
      item.product
      && (item.product as Record<string, unknown>).delivery_type !== 'api'
      && (item.product as Record<string, unknown>).slug !== 'canva-pro',
    );

    const productIds = [...new Set(items.map((item: Record<string, unknown>) =>
      (item.product as Record<string, unknown>).id as string,
    ))];
    const { data: privateDeliveries, error: deliveryError } = productIds.length
      ? await client.from('product_deliveries').select('product_id, access_url').in('product_id', productIds)
      : { data: [], error: null };
    if (deliveryError) throw deliveryError;
    const urlsByProduct = new Map((privateDeliveries || []).map((delivery) =>
      [delivery.product_id, delivery.access_url],
    ));

    const generated = [];
    for (const item of items as Array<Record<string, unknown>>) {
      const product = item.product as Record<string, unknown>;
      const type = String(product.delivery_type || 'activate');
      const sourceUrl = urlsByProduct.get(product.id as string);
      if (type === 'activate') {
        generated.push({
          productId: product.id,
          type,
          name: String(item.product_name),
          url: sourceUrl,
          error: sourceUrl ? null : 'Le lien d’activation de ce produit n’est pas configuré.',
        });
        continue;
      }

      if (type !== 'download') continue;
      if (!sourceUrl || !product.download_filename || !product.download_size) {
        return jsonResponse({ error: `Le fichier de ${String(item.product_name)} n’est pas encore configuré dans l’admin.` }, 409);
      }

      const token = crypto.randomUUID();
      const tokenHash = await hashToken(token);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
      const { error: insertError } = await client.from('shop_download_tokens').insert({
        token_hash: tokenHash,
        order_id: order.id,
        product_id: product.id,
        expires_at: expiresAt,
      });
      if (insertError) throw insertError;
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      if (!supabaseUrl) throw new Error('La configuration serveur Supabase est incomplète.');
      generated.push({
        productId: product.id,
        type,
        name: String(item.product_name),
        filename: String(product.download_filename || ''),
        size: String(product.download_size || ''),
        lineTotal: Number(item.line_total),
        url: `${supabaseUrl}/functions/v1/shop-download?token=${encodeURIComponent(token)}`,
        expiresAt,
      });
    }

    const downloads = generated.filter((item) => item.type === 'download');
    let email = { sent: true, message: '' };
    if (downloads.length) {
      if (!customer?.email) {
        email = { sent: false, message: 'Aucune adresse e-mail n’est associée à cette commande.' };
      } else {
        email = await sendDownloadEmail(
          customer.email,
          customer.name || 'client',
          downloads.map((item) => ({ name: item.filename, size: item.size, url: item.url })),
        );
      }
    }

    return jsonResponse({ deliveries: generated, email });
  } catch (error) {
    console.error('Échec de préparation de livraison boutique :', error);
    return jsonResponse({ error: 'Impossible de préparer la livraison de cette commande.' }, 500);
  }
});
