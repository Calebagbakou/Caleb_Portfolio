import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import useSiteLogo from '../../hooks/useSiteLogo';
import { useAuth } from '../../context/AuthContext';

/**
 * showFullNav / showMobileButton : sur commande.html et confirmation.html,
 * l'ancien projet n'affichait qu'une nav réduite (Accueil/Catalogue) et pas
 * de bouton menu mobile — on reproduit cette différence ici.
 */
export default function ShopHeader({ showFullNav = true, showMobileButton = true }) {
  const { count } = useCart();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoUrl, clearLogoUrl] = useSiteLogo();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountMenuError, setAccountMenuError] = useState('');
  const accountMenuRef = useRef(null);
  const initials = (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'CC')
    .split(/[\s@]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
  }, [mobileOpen]);

  useEffect(() => {
    function closeAccountMenu(event) {
      if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
    }
    document.addEventListener('pointerdown', closeAccountMenu);
    return () => document.removeEventListener('pointerdown', closeAccountMenu);
  }, []);

  async function handleAccountLogout() {
    setAccountMenuError('');
    try {
      await logout();
      setAccountMenuOpen(false);
      navigate('/boutique', { replace: true });
    } catch (error) {
      console.error('Déconnexion du compte client impossible :', error);
      setAccountMenuError('La déconnexion a échoué. Réessayez.');
    }
  }

  return (
    <>
      <header className="shop-header">
        <div className="shop-header-row">
          <Link to="/boutique" className="shop-brand">
            <span className={`shop-brand-mark${logoUrl ? ' has-logo' : ''}`}>
              {logoUrl ? <img src={logoUrl} alt="" onError={clearLogoUrl} /> : 'CA'}
            </span>
            <span className="shop-brand-text">
              Caleb Creative<span>Boutique</span>
            </span>
          </Link>

          <nav className="shop-nav">
            <NavLink to="/boutique" end>
              Accueil
            </NavLink>
            <NavLink to="/boutique/catalogue">Catalogue</NavLink>
            {showFullNav && (
              <>
                <Link to="/boutique/catalogue?cat=ia">Intelligence artificielle</Link>
                <Link to="/boutique/catalogue?cat=logiciels">Logiciels créatifs</Link>
              </>
            )}
          </nav>

          <div className="shop-actions">
            <Link className="portfolio-link" to="/">
              ← Portfolio
            </Link>
            {user?.email_confirmed_at ? (
              <div className="shop-account-menu" ref={accountMenuRef}>
                <button
                  type="button"
                  className="shop-account-trigger"
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setAccountMenuOpen((open) => !open)}
                >
                  <span className="shop-account-avatar">{initials}</span>
                  <span>Mon compte</span>
                </button>
                {accountMenuOpen && (
                  <div className="shop-account-dropdown" role="menu">
                    <Link role="menuitem" to="/boutique/compte" onClick={() => setAccountMenuOpen(false)}>Mes commandes</Link>
                    <Link role="menuitem" to="/boutique/compte?section=profile" onClick={() => setAccountMenuOpen(false)}>Profil et sécurité</Link>
                    <Link role="menuitem" to="/boutique/compte?section=support" onClick={() => setAccountMenuOpen(false)}>Assistance</Link>
                    {accountMenuError && <span className="shop-account-menu-error" role="alert">{accountMenuError}</span>}
                    <button type="button" role="menuitem" onClick={handleAccountLogout}>Se déconnecter</button>
                  </div>
                )}
              </div>
            ) : (
              <Link className="shop-account-link" to="/boutique/connexion?next=%2Fboutique%2Fcompte">Se connecter</Link>
            )}
            {showMobileButton && (
              <button
                className="shop-icon-btn mobile-nav-btn"
                aria-label="Ouvrir le menu"
                onClick={() => setMobileOpen(true)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
            )}
            <Link className="shop-icon-btn" to="/boutique/panier" aria-label="Voir le panier">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 3h2l2.4 12.4a2 2 0 002 1.6h8.2a2 2 0 002-1.6L21 8H6" />
                <circle cx="9" cy="20" r="1.4" />
                <circle cx="17" cy="20" r="1.4" />
              </svg>
              <span className="cart-badge" style={{ display: count > 0 ? 'flex' : 'none' }}>
                {count}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {showMobileButton && (
        <div className={`mobile-nav${mobileOpen ? ' open' : ''}`}>
          <div className="mobile-nav-top">
            <Link to="/boutique" className="shop-brand" onClick={() => setMobileOpen(false)}>
              <span className={`shop-brand-mark${logoUrl ? ' has-logo' : ''}`}>
                {logoUrl ? <img src={logoUrl} alt="" onError={clearLogoUrl} /> : 'CA'}
              </span>
              <span className="shop-brand-text">
                Caleb Creative<span>Boutique</span>
              </span>
            </Link>
            <button className="mobile-nav-close" aria-label="Fermer le menu" onClick={() => setMobileOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <Link to="/boutique" onClick={() => setMobileOpen(false)}>
            Accueil
          </Link>
          <Link to="/boutique/catalogue" onClick={() => setMobileOpen(false)}>
            Catalogue
          </Link>
          <Link to="/boutique/panier" onClick={() => setMobileOpen(false)}>
            Panier
          </Link>
          <Link to={user?.email_confirmed_at ? '/boutique/compte' : '/boutique/connexion?next=%2Fboutique%2Fcompte'} onClick={() => setMobileOpen(false)}>
            {user?.email_confirmed_at ? 'Mon compte' : 'Se connecter'}
          </Link>
          <Link to="/" onClick={() => setMobileOpen(false)}>
            ← Retour au portfolio
          </Link>
        </div>
      )}
    </>
  );
}
