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

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';
const configError = new Error(
  'Configuration Supabase manquante. Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans ton fichier .env.'
);

function createFallbackQuery() {
  const result = {
    data: [],
    count: null,
    error: configError,
    select() {
      return this;
    },
    eq() {
      return this;
    },
    order() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({ data: null, error: configError });
    },
    insert() {
      return Promise.resolve({ data: null, error: configError });
    },
    update() {
      return this;
    },
    delete() {
      return this;
    },
    upsert() {
      return Promise.resolve({ data: null, error: configError });
    },
    then(resolve, reject) {
      return Promise.resolve({ data: [], count: null, error: configError }).then(resolve, reject);
    },
    catch(onRejected) {
      return Promise.resolve({ data: [], count: null, error: configError }).catch(onRejected);
    },
  };

  return result;
}

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  console.warn(
    'Configuration Supabase manquante. Vérifie ton fichier .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).'
  );
}

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({
          data: {
            subscription: {
              unsubscribe() {},
            },
          },
          error: null,
        }),
        signInWithPassword: async () => ({ data: null, error: configError }),
        signOut: async () => ({ error: null }),
        resetPasswordForEmail: async () => ({ data: null, error: configError }),
        updateUser: async () => ({ data: { user: null }, error: null }),
      },
      from: () => createFallbackQuery(),
      functions: {
        invoke: async () => ({ data: null, error: configError }),
      },
    };
