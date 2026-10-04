/* =========================================================================
   SERVICE — MESSAGES (table "messages")
   -------------------------------------------------------------------------
   Utilisé par : le formulaire de contact public (insert) et l'écran admin
   Messages (list / update / delete).
   ========================================================================= */

import { supabase } from './supabase';

export async function sendContactMessage({ name, email, message }) {
  return supabase.from('messages').insert({
    name,
    email,
    content: message,
  });
}

export async function listMessages() {
  return supabase
    .from('messages')
    .select('id, name, email, phone, content, is_read, created_at')
    .order('created_at', { ascending: false });
}

export async function setMessageRead(id, isRead) {
  return supabase.from('messages').update({ is_read: isRead }).eq('id', id);
}

export async function deleteMessage(id) {
  return supabase.from('messages').delete().eq('id', id);
}

export async function countUnreadMessages() {
  return supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);
}
