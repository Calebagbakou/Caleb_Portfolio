import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getBuyerNextPath, isAllowedBuyerEmail } from '../../utils/buyerAuth';

export default function BuyerAuthGate({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <main className="wrap"><div className="shop-state">Vérification de votre connexion…</div></main>;
  }
  if (!user?.email_confirmed_at || !isAllowedBuyerEmail(user.email)) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/boutique/connexion?next=${encodeURIComponent(getBuyerNextPath(next))}`} replace />;
  }
  return children;
}
