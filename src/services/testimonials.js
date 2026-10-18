import { supabase } from './supabase';

export function listPublishedTestimonials() {
  return supabase
    .from('testimonials')
    .select('id, name, content, photo_url, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false });
}

export function listTestimonials() {
  return supabase
    .from('testimonials')
    .select('id, name, content, photo_url, is_published, created_at')
    .order('created_at', { ascending: false });
}

export function createTestimonial({ name, content, photoUrl = '', isPublished = false }) {
  return supabase.from('testimonials').insert({
    name,
    content,
    photo_url: photoUrl || null,
    is_published: isPublished,
  });
}

export function updateTestimonial(id, changes) {
  return supabase.from('testimonials').update(changes).eq('id', id);
}

export function deleteTestimonial(id) {
  return supabase.from('testimonials').delete().eq('id', id);
}

export async function uploadTestimonialPhoto(file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `testimonials/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('site-media').upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) return { data: null, error };
  const { data } = supabase.storage.from('site-media').getPublicUrl(path);
  return { data: data.publicUrl, error: null };
}
