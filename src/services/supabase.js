/* =========================================================================
   CLIENT SUPABASE PARTAGÉ — CALEB CREATIVE
   -------------------------------------------------------------------------
   Source unique de connexion à Supabase pour tout le projet (site public,
   boutique et admin). Toutes les autres couches (context, services/*.js)
   passent par cet unique client.

   Les valeurs viennent des variables d'environnement Vite (voir .env et
   .env.example) :
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY

   ⚠️ Ne mets jamais la clé "service_role" ici : seule la clé "anon" est
   faite pour être exposée côté navigateur (la sécurité vient des règles
   RLS définies dans supabase/schema.sql, pas du secret de la clé).
   ========================================================================= */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // On avertit plutôt que de planter : certaines pages (aucune ne devrait
  // exister sans Supabase, mais on reste défensif) pourraient sinon
  // provoquer un écran blanc au lieu d'un message clair.
  console.error(
    'Configuration Supabase manquante. Vérifie ton fichier .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
