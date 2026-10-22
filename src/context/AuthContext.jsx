/* =========================================================================
   AUTH CONTEXT — CALEB CREATIVE ADMIN
   -------------------------------------------------------------------------
   Centralise ce qui vivait avant dans admin/assets/auth.js (requireAdminSession,
   logout), mais sous forme de contexte React partagé par toutes les pages
   admin, pour éviter de répéter la logique dans chaque page.

   - user / session : état de connexion Supabase
   - isAdmin : vrai si le compte connecté est bien présent dans la table
     "admins" (une connexion réussie ne suffit pas)
   - loading : vrai pendant la vérification initiale de session
   - login(email, password) / logout()
   ========================================================================= */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error || 'Erreur inconnue.');
}

function formatLoginError(error) {
  const code = error?.code || '';
  const message = getErrorMessage(error);

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return 'Adresse e-mail ou mot de passe incorrect.';
  }
  if (code === 'email_not_confirmed') {
    return 'Cette adresse e-mail n’a pas encore été confirmée. Vérifie ta boîte de réception.';
  }
  if (code === 'over_request_rate_limit') {
    return 'Trop de tentatives. Attends quelques minutes avant de réessayer.';
  }
  if (/configuration supabase manquante/i.test(message)) {
    return message;
  }
  if (/failed to fetch|network|fetch failed/i.test(message)) {
    return 'Connexion à Supabase impossible. Vérifie ta connexion Internet et la configuration du site.';
  }
  return `Connexion impossible : ${message}`;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckError, setAdminCheckError] = useState('');
  const [loading, setLoading] = useState(true);

  const checkAdmin = useCallback(async (currentSession) => {
    if (!currentSession) {
      setIsAdmin(false);
      setAdminCheckError('');
      return false;
    }
    const { data, error } = await supabase
      .from('admins')
      .select('id')
      .eq('id', currentSession.user.id)
      .maybeSingle();
    if (error) {
      setIsAdmin(false);
      setAdminCheckError(error.message);
      throw error;
    }
    const ok = !!data;
    setIsAdmin(ok);
    setAdminCheckError('');
    return ok;
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;
        setSession(data.session);
        try {
          await checkAdmin(data.session);
        } catch (checkError) {
          console.error('Impossible de vérifier les droits administrateur.', checkError);
        }
      } catch (error) {
        if (mounted) {
          setSession(null);
          setIsAdmin(false);
          setAdminCheckError(getErrorMessage(error));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      checkAdmin(newSession).catch((error) => {
        console.error('Impossible de vérifier les droits administrateur.', error);
      });
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [checkAdmin]);

  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      return { error: formatLoginError(error) };
    }

    try {
      const ok = await checkAdmin(data.session);
      if (!ok) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          return {
            error: `Ce compte n'a pas les droits d'administration. La déconnexion a aussi échoué : ${signOutError.message}`,
            denied: true,
          };
        }
        return { error: "Ce compte n'a pas les droits d'administration.", denied: true };
      }
    } catch (checkError) {
      const { error: signOutError } = await supabase.auth.signOut();
      const signOutMessage = signOutError ? ` La déconnexion a échoué : ${signOutError.message}` : '';
      return {
        error: `La connexion a réussi, mais la vérification des droits admin a échoué. Vérifie la table public.admins et ses règles RLS. Détail : ${getErrorMessage(checkError)}${signOutMessage}`,
      };
    }
    return { error: null };
  }, [checkAdmin]);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    isAdmin,
    adminCheckError,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé à l’intérieur de <AuthProvider>.');
  return ctx;
}
