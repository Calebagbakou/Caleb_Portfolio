import { getServiceClient } from '../_shared/shop.ts';

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashToken(token: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return toHex(new Uint8Array(bytes));
}

function isPublicHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    if (host.includes(':') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchPublicFile(initialUrl: string) {
  let url = initialUrl;
  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    if (!isPublicHttpsUrl(url)) throw new Error('La source de téléchargement n’est pas un hôte HTTPS public.');
    const response = await fetch(url, { redirect: 'manual' });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get('location');
    if (!location) throw new Error('L’hébergeur a renvoyé une redirection sans destination.');
    url = new URL(location, url).toString();
  }
  throw new Error('Trop de redirections pendant la récupération du fichier.');
}

function googleDriveDownloadUrl(value: string) {
  const url = new URL(value);
  if (url.hostname !== 'drive.google.com') return value;
  const match = url.pathname.match(/\/file\/d\/([^/]+)/);
  const fileId = match?.[1] || url.searchParams.get('id');
  if (!fileId) return value;
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download`;
}

Deno.serve(async (request) => {
  if (request.method !== 'GET') {
    return new Response('Méthode non autorisée.', { status: 405 });
  }

  try {
    const token = new URL(request.url).searchParams.get('token') || '';
    if (!/^[0-9a-f-]{36}$/i.test(token)) {
      return new Response('Lien de téléchargement invalide ou expiré.', { status: 404 });
    }
    const client = getServiceClient();
    const { data: download, error } = await client
      .from('shop_download_tokens')
      .select(`
        expires_at,
        orders ( payment_status ),
        products ( download_filename ),
        product_deliveries ( access_url )
      `)
      .eq('token_hash', await hashToken(token))
      .maybeSingle();
    if (error) throw error;
    if (!download || new Date(download.expires_at).getTime() <= Date.now()) {
      return new Response('Lien de téléchargement invalide ou expiré.', { status: 410 });
    }

    const order = Array.isArray(download.orders) ? download.orders[0] : download.orders;
    const product = Array.isArray(download.products) ? download.products[0] : download.products;
    const delivery = Array.isArray(download.product_deliveries)
      ? download.product_deliveries[0]
      : download.product_deliveries;
    if (order?.payment_status !== 'confirme' || !product?.download_filename || !delivery?.access_url) {
      return new Response('La commande ne permet pas ce téléchargement.', { status: 403 });
    }

    let sourceUrl: string;
    try {
      sourceUrl = googleDriveDownloadUrl(delivery.access_url);
    } catch {
      return new Response('Le lien source du fichier est invalide.', { status: 502 });
    }
    if (!isPublicHttpsUrl(sourceUrl)) {
      return new Response('La source du fichier n’est pas disponible en HTTPS.', { status: 502 });
    }
    const upstream = await fetchPublicFile(sourceUrl);
    if (!upstream.ok || !upstream.body || upstream.headers.get('content-type')?.includes('text/html')) {
      return new Response('L’hébergeur n’a pas fourni directement le fichier. Vérifie le lien source dans l’admin.', {
        status: 502,
      });
    }

    const filename = String(product.download_filename).replace(/[\r\n"]/g, '_');
    const encodedFilename = encodeURIComponent(filename).replace(/['()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    const headers = new Headers({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="download"; filename*=UTF-8''${encodedFilename}`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    });
    const contentLength = upstream.headers.get('content-length');
    if (contentLength && /^\d+$/.test(contentLength)) headers.set('Content-Length', contentLength);
    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error('Échec du téléchargement temporaire :', error);
    return new Response('Téléchargement temporairement indisponible. Réessaie ou contacte Caleb.', { status: 500 });
  }
});
