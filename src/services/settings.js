/* =========================================================================
   SERVICE — PARAMÈTRES (table "settings", clé/valeur)
   -------------------------------------------------------------------------
   Utilisé par l'écran admin Paramètres.
   ========================================================================= */

import { supabase } from './supabase';

export async function getSettings() {
  return supabase.from('settings').select('key, value');
}

export async function saveSettings(rows) {
  // rows: [{ key, value }, ...]
  return supabase.from('settings').upsert(rows, { onConflict: 'key' });
}
