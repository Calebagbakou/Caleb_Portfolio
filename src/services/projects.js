import { supabase } from './supabase';

const PROJECT_COLUMNS = 'id, slug, title, description, category, media_type, media_url, thumbnail_url, published, status, category_id, cover_media_id, video_media_id, created_at, updated_at';

function getStoredMediaUrl(media) {
  if (!media) return null;
  if (media.external_url) return media.external_url;
  if (!media.storage_path || !supabase.storage) return null;
  return supabase.storage.from('media').getPublicUrl(media.storage_path).data.publicUrl || null;
}

function mediaTypeFromMedia(media, fallback) {
  if (!media) return fallback;
  if (media.type === 'youtube' || /(?:youtube\.com|youtu\.be)/i.test(media.external_url || '')) return 'youtube';
  if (media.type?.includes('video')) return 'external_video';
  return fallback;
}

async function fetchProjects({ publishedOnly = false } = {}) {
  let query = supabase.from('projects').select(PROJECT_COLUMNS);
  if (publishedOnly) {
    query = query.eq('published', true).eq('status', 'published');
  }

  const { data, error, count } = await query.order('created_at', { ascending: false });
  if (error || !data?.length) return { data, error, count };

  const mediaIds = [...new Set(data.flatMap((project) => [
    project.cover_media_id,
    project.video_media_id,
  ]).filter(Boolean))];
  if (!mediaIds.length) return { data, error: null, count };

  const { data: mediaRows, error: mediaError } = await supabase
    .from('media')
    .select('id, alt_text, external_url, storage_path, thumbnail_url, type')
    .in('id', mediaIds);
  if (mediaError) {
    console.error('Les médias liés aux projets n’ont pas pu être chargés :', mediaError);
  }
  const mediaById = new Map((mediaRows || []).map((media) => [media.id, media]));

  return {
    data: data.map((project) => {
      const coverMedia = mediaById.get(project.cover_media_id);
      const videoMedia = mediaById.get(project.video_media_id);
      return {
        ...project,
        media_type: mediaTypeFromMedia(videoMedia, project.media_type),
        media_url: project.media_url || getStoredMediaUrl(videoMedia) || getStoredMediaUrl(coverMedia),
        thumbnail_url: project.thumbnail_url
          || coverMedia?.thumbnail_url
          || getStoredMediaUrl(coverMedia),
        category: project.category || 'Autres',
      };
    }),
    error: null,
    count,
  };
}

function slugForTitle(title) {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'projet';
  const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8)
    || Math.random().toString(36).slice(2, 10);
  return `${slug}-${suffix}`;
}

export function listProjects() {
  return fetchProjects();
}

export function listPublishedProjects() {
  return fetchProjects({ publishedOnly: true });
}

export async function createProject(project) {
  return supabase
    .from('projects')
    .insert({
      ...project,
      slug: slugForTitle(project.title),
      status: project.published ? 'published' : 'draft',
    })
    .select()
    .single();
}

export function updateProject(id, project) {
  const updates = { ...project };
  if (Object.hasOwn(updates, 'published')) {
    updates.status = updates.published ? 'published' : 'draft';
  }
  return supabase.from('projects').update(updates).eq('id', id).select().single();
}

export function deleteProject(id) {
  return supabase.from('projects').delete().eq('id', id);
}
