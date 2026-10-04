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

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdmin = useCallback(async (currentSession) => {
    if (!currentSession) {
      setIsAdmin(false);
      return false;
    }
    const { data } = await supabase
      .from('admins')
      .select('id')
      .eq('id', currentSession.user.id)
      .maybeSingle();
    const ok = !!data;
    setIsAdmin(ok);
    return ok;
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(currentSession);
      await checkAdmin(currentSession);
      if (mounted) setLoading(false);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      await checkAdmin(newSession);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [checkAdmin]);

  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: "Identifiants incorrects." };
    }

    const ok = await checkAdmin(data.session);
    if (!ok) {
      await supabase.auth.signOut();
      return { error: "Ce compte n'a pas les droits d'administration.", denied: true };
    }
    return { error: null };
  }, [checkAdmin]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    isAdmin,
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
