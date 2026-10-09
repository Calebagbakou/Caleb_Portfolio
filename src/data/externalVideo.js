function isHost(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function wistiaEmbedUrl(url) {
  const isWistiaHost = ['wistia.com', 'wistia.net'].some((domain) => isHost(url.hostname, domain));
  if (!isWistiaHost) return null;

  const segments = url.pathname.split('/').filter(Boolean);
  let mediaId = null;
  if (segments[0] === 'medias' || (segments[0] === 'embed' && segments[1] === 'medias')) {
    mediaId = segments[segments[0] === 'medias' ? 1 : 2];
  } else if (segments[0] === 'embed' && segments[1] === 'iframe') {
    mediaId = segments[2];
  }

  if (!/^[a-z0-9]+$/i.test(mediaId || '')) return null;

  const embedUrl = new URL(`https://fast.wistia.net/embed/iframe/${mediaId}`);
  url.searchParams.forEach((value, key) => embedUrl.searchParams.set(key, value));
  embedUrl.searchParams.set('videoFoam', 'true');
  return embedUrl.href;
}

function isWistiaShareUrl(value) {
  try {
    const url = new URL(value);
    return ['wistia.com', 'wistia.net'].some((domain) => isHost(url.hostname, domain))
      && /^\/s\/[a-z0-9]+\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

async function resolveWistiaShareUrl(value) {
  const endpoint = new URL('https://fast.wistia.net/oembed');
  endpoint.searchParams.set('url', value);
  endpoint.searchParams.set('embedType', 'iframe');

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Wistia n’a pas pu résoudre ce lien (HTTP ${response.status}).`);
  }
  const embed = await response.json();
  const iframeSrc = embed.html?.match(/<iframe\b[^>]*\bsrc="([^"]+)"/i)?.[1];
  if (!iframeSrc) throw new Error('Wistia n’a pas renvoyé de lecteur vidéo intégrable.');

  const playerUrl = new URL(iframeSrc);
  if (playerUrl.protocol !== 'https:'
    || playerUrl.hostname !== 'fast.wistia.net'
    || !playerUrl.pathname.startsWith('/embed/iframe/')) {
    throw new Error('Wistia a renvoyé une URL de lecteur non prise en charge.');
  }

  playerUrl.searchParams.set('videoFoam', 'true');
  const width = Number(embed.width);
  const height = Number(embed.height);
  return {
    kind: 'embed',
    src: playerUrl.href,
    aspectRatio: width > 0 && height > 0 ? `${width} / ${height}` : undefined,
  };
}

export function getExternalVideoSource(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

    const wistiaSrc = wistiaEmbedUrl(url);
    if (wistiaSrc) return { kind: 'embed', src: wistiaSrc };

    if (url.hostname === 'player.vimeo.com' || url.hostname === 'www.youtube.com') {
      return { kind: 'embed', src: url.href };
    }
    if (url.hostname === 'vimeo.com' || url.hostname === 'www.vimeo.com') {
      const videoId = url.pathname.split('/').filter(Boolean)[0];
      if (/^\d+$/.test(videoId || '')) {
        const playerUrl = new URL(`https://player.vimeo.com/video/${videoId}`);
        const unlistedHash = url.searchParams.get('h');
        if (unlistedHash) playerUrl.searchParams.set('h', unlistedHash);
        return { kind: 'embed', src: playerUrl.href };
      }
    }
    if (['wistia.com', 'wistia.net'].some((domain) => isHost(url.hostname, domain))) {
      return null;
    }
    return { kind: 'file', src: url.href };
  } catch {
    return null;
  }
}

export async function resolveExternalVideoSource(value) {
  if (isWistiaShareUrl(value)) return resolveWistiaShareUrl(value);
  return getExternalVideoSource(value);
}
