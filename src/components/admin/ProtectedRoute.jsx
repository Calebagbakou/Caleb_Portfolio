import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Empêche un visiteur non connecté (ou connecté mais absent de la table
 * "admins") d'accéder aux pages admin simplement en tapant leur URL —
 * équivalent React de l'ancien requireAdminSession() de admin/assets/auth.js.
 */
export default function ProtectedRoute({ children }) {
  const { session, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="admin-boot-state">Vérification de la session…</div>;
  }

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login?denied=1" replace />;
  }

  return children;
}
