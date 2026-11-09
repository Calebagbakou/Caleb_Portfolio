import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getBuyerNextPath, getSmmNextPath, isAllowedBuyerEmail } from '../../utils/buyerAuth';

export default function BuyerAuthGate({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <main className="wrap"><div className="shop-state">Vérification de votre connexion…</div></main>;
  }
  const isSmmRoute = location.pathname.startsWith('/smm');
  if (!user?.email_confirmed_at || (!isSmmRoute && !isAllowedBuyerEmail(user.email))) {
    const next = `${location.pathname}${location.search}`;
    if (isSmmRoute) {
      return <Navigate to={`/smm/connexion?next=${encodeURIComponent(getSmmNextPath(next))}`} replace />;
    }
    return <Navigate to={`/boutique/connexion?next=${encodeURIComponent(getBuyerNextPath(next))}`} replace />;
  }
  return children;
}
