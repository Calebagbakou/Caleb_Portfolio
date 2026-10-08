const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeVideoId(value) {
  if (typeof value !== 'string' || !value.trim()) return null;

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (hostname === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return YOUTUBE_ID_PATTERN.test(id || '') ? id : null;
  }

  if (hostname !== 'youtube.com' && hostname !== 'm.youtube.com' && hostname !== 'youtube-nocookie.com') {
    return null;
  }

  const segments = url.pathname.split('/').filter(Boolean);
  const id = url.pathname === '/watch'
    ? url.searchParams.get('v')
    : ['shorts', 'embed', 'live'].includes(segments[0])
      ? segments[1]
      : null;

  return YOUTUBE_ID_PATTERN.test(id || '') ? id : null;
}

export function normalizeYouTubeUrl(value) {
  const id = extractYouTubeVideoId(value);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

export function getYouTubeEmbedUrl(value) {
  const id = extractYouTubeVideoId(value);
  return id
    ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0`
    : null;
}
