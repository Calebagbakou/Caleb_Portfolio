import { buildDownloadHeaders, monitorDownloadStream } from '../_shared/downloadFile.mjs';

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashToken(token) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return toHex(new Uint8Array(bytes));
}

function isPublicHttpsUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    if (host.includes(':') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    return true;
  } catch (error) {
    return false;
  }
}

function isGoogleDriveHost(hostname) {
  return hostname === 'drive.google.com'
    || hostname === 'www.drive.google.com'
    || hostname === 'drive.usercontent.google.com';
}

function getDriveConfirmation(html, response) {
  const cookie = response.headers.get('set-cookie') || '';
  const cookieToken = cookie.match(/download_warning[^=]*=([^;\s,]+)/)?.[1];
  if (cookieToken) return cookieToken;

  const htmlToken = html.match(/[?&]confirm=([0-9A-Za-z_-]+)/)?.[1]
    || html.match(/name=["']confirm["'][^>]*value=["']([^"']+)/i)?.[1]
    || html.match(/value=["']([^"']+)["'][^>]*name=["']confirm["']/i)?.[1];
  return htmlToken ? htmlToken.replace(/&amp;/g, '&') : null;
}

async function fetchPublicFile(initialUrl, range, fetchImpl) {
  let url = initialUrl;
  let cookieHeader = '';
  for (let redirectCount = 0; redirectCount <= 8; redirectCount += 1) {
    if (!isPublicHttpsUrl(url)) throw new Error('La source de téléchargement n’est pas un hôte HTTPS public.');
    const headers = new Headers();
    if (range) headers.set('Range', range);
    if (cookieHeader) headers.set('Cookie', cookieHeader);
    const response = await fetchImpl(url, { headers, redirect: 'manual' });
    const setCookie = response.headers.get('set-cookie');
    const driveCookie = setCookie?.match(/(download_warning[^=]*=[^;\s,]+)/)?.[1];
    if (driveCookie) cookieHeader = driveCookie;

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('L’hébergeur a renvoyé une redirection sans destination.');
      url = new URL(location, url).toString();
      continue;
    }

    const contentType = response.headers.get('content-type') || '';
    const currentUrl = new URL(url);
    if (contentType.toLowerCase().includes('text/html') && isGoogleDriveHost(currentUrl.hostname)) {
      const html = await response.text();
      const confirmation = getDriveConfirmation(html, response);
      if (confirmation && currentUrl.searchParams.get('confirm') !== confirmation) {
        currentUrl.searchParams.set('confirm', confirmation);
        url = currentUrl.toString();
        continue;
      }
      return new Response(html, {
        status: response.status,
        headers: response.headers,
      });
    }

    return response;
  }
  throw new Error('Trop de redirections pendant la récupération du fichier.');
}

function googleDriveDownloadUrl(value) {
  const url = new URL(value);
  if (url.hostname !== 'drive.google.com') return value;
  const match = url.pathname.match(/\/file\/d\/([^/]+)/);
  const fileId = match?.[1] || url.searchParams.get('id');
  if (!fileId) return value;
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}&confirm=t`;
}

function failure(message, status) {
  return new Response(message, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function cancelUpstreamBody(response) {
  try {
    await response.body?.cancel();
  } catch (error) {
    console.warn(
      'Impossible d’annuler le flux source du téléchargement.',
      error instanceof Error ? error.name : 'Erreur inconnue',
    );
  }
}

export function createDownloadHandler({ getServiceClient, fetchImpl = fetch }) {
  return async function handleDownload(request) {
    if (request.method !== 'GET') return failure('Méthode non autorisée.', 405);

    try {
      const token = new URL(request.url).searchParams.get('token') || '';
      if (!/^[0-9a-f-]{36}$/i.test(token)) {
        return failure('Lien de téléchargement invalide ou expiré.', 404);
      }
      const client = getServiceClient();
      const { data: download, error } = await client
        .from('shop_download_tokens')
        .select(`
          expires_at,
          orders ( payment_status ),
          product_id,
          products ( download_filename )
        `)
        .eq('token_hash', await hashToken(token))
        .maybeSingle();
      if (error) throw error;
      if (!download || new Date(download.expires_at).getTime() <= Date.now()) {
        return failure('Lien de téléchargement invalide ou expiré.', 410);
      }

      const order = Array.isArray(download.orders) ? download.orders[0] : download.orders;
      const product = Array.isArray(download.products) ? download.products[0] : download.products;
      const { data: delivery, error: deliveryError } = await client
        .from('product_deliveries')
        .select('access_url')
        .eq('product_id', download.product_id)
        .maybeSingle();
      if (deliveryError) throw deliveryError;
      if (order?.payment_status !== 'confirme' || !product?.download_filename || !delivery?.access_url) {
        return failure('La commande ne permet pas ce téléchargement.', 403);
      }

      let sourceUrl;
      try {
        sourceUrl = googleDriveDownloadUrl(delivery.access_url);
      } catch {
        return failure('Le lien source du fichier est invalide.', 502);
      }
      if (!isPublicHttpsUrl(sourceUrl)) {
        return failure('La source du fichier n’est pas disponible en HTTPS.', 502);
      }
      const upstream = await fetchPublicFile(sourceUrl, request.headers.get('range'), fetchImpl);
      const upstreamContentType = upstream.headers.get('content-type') || '';
      if (!upstream.ok || !upstream.body || upstreamContentType.toLowerCase().includes('text/html')) {
        await cancelUpstreamBody(upstream);
        return failure('L’hébergeur n’a pas fourni directement le fichier. Vérifie le lien source dans l’admin.', 502);
      }

      let downloadHeaders;
      try {
        downloadHeaders = buildDownloadHeaders(
          product.download_filename,
          upstream.headers.get('content-disposition') || '',
          upstreamContentType,
        );
      } catch {
        console.error('Téléchargement indisponible : nom de fichier sans extension reconnue.');
        await cancelUpstreamBody(upstream);
        return failure('Téléchargement indisponible, contactez le support', 409);
      }

      const headers = new Headers({
        ...downloadHeaders,
        'Cache-Control': 'private, no-store, max-age=0',
      });
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) headers.set('Content-Range', contentRange);
      if (upstream.status === 206) headers.set('Accept-Ranges', 'bytes');
      const contentLength = upstream.headers.get('content-length');
      const expectedLength = contentLength && /^\d+$/.test(contentLength) ? Number(contentLength) : null;
      if (expectedLength !== null) headers.set('Content-Length', contentLength);
      return new Response(monitorDownloadStream(upstream.body, expectedLength), {
        status: upstream.status,
        headers,
      });
    } catch (error) {
      console.error('Échec du téléchargement temporaire :', error instanceof Error ? error.name : 'Erreur inconnue');
      return failure('Téléchargement temporairement indisponible. Réessaie ou contacte Caleb.', 500);
    }
  };
}
