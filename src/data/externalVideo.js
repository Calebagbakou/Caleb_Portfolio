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
    return { kind: 'file', src: url.href };
  } catch {
    return null;
  }
}
