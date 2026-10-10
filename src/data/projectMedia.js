const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function getProjectThumbnailUrl(project) {
  if (project?.thumbnail_url) return project.thumbnail_url;
  if (project?.media_type === 'youtube') {
    const videoId = extractYouTubeVideoId(project.media_url);
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  }
  return project?.media_type === 'image' ? project.media_url || null : null;
}

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

export function getYouTubeShortOrientation(value) {
  if (!extractYouTubeVideoId(value)) return null;
  const url = new URL(value.trim());
  return url.pathname.split('/').filter(Boolean)[0] === 'shorts' ? 'portrait' : null;
}

export function getVideoOrientationFromDimensions(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return height > width ? 'portrait' : 'landscape';
}

export function isAIVideoCategory(category) {
  const normalized = String(category || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  return normalized === 'videos' || normalized === 'videosia';
}

export function getBaseProjectCategory(category) {
  return String(category || '').replace(/-(portrait|landscape)$/i, '');
}

export function getVideoOrientationFromCategory(category) {
  const match = String(category || '').match(/-(portrait|landscape)$/i);
  return match?.[1]?.toLowerCase() || null;
}

export function getProjectCategoryForVideo(category, orientation) {
  if (!isAIVideoCategory(category)) return category;
  return `videos-${orientation === 'portrait' ? 'portrait' : 'landscape'}`;
}

export function getYouTubeEmbedUrl(value) {
  const id = extractYouTubeVideoId(value);
  if (!id) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams({
    enablejsapi: '1',
    autoplay: '1',
    controls: '1',
    playsinline: '1',
    rel: '0',
  });
  if (origin) params.set('origin', origin);
  return `https://www.youtube.com/embed/${id}?${params}`;
}

export function getYouTubePreviewUrl(value) {
  const playerUrl = getYouTubeEmbedUrl(value);
  if (!playerUrl) return null;
  const url = new URL(playerUrl);
  url.searchParams.set('autoplay', '0');
  url.searchParams.set('controls', '0');
  return url.href;
}
