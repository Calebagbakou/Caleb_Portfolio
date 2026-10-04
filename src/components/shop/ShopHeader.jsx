import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useCart } from '../../context/CartContext';

/**
 * showFullNav / showMobileButton : sur commande.html et confirmation.html,
 * l'ancien projet n'affichait qu'une nav réduite (Accueil/Catalogue) et pas
 * de bouton menu mobile — on reproduit cette différence ici.
 */
export default function ShopHeader({ showFullNav = true, showMobileButton = true }) {
  const { count } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
  }, [mobileOpen]);

  return (
    <>
      <header className="shop-header">
        <div className="shop-header-row">
          <Link to="/boutique" className="shop-brand">
            <span className="shop-brand-mark">CA</span>
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
              <span className="shop-brand-mark">CA</span>
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
          <Link to="/" onClick={() => setMobileOpen(false)}>
            ← Retour au portfolio
          </Link>
        </div>
      )}
    </>
  );
}
