import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import ShopHeader from '../components/shop/ShopHeader';
import { supabase } from '../services/supabase';
import '../styles/shop.css';
import '../styles/shop-trust.css';

export default function SmmLayout() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);

  useLayoutEffect(() => {
    document.body.classList.add('shop-theme');
    document.documentElement.classList.add('shop-active');
    return () => {
      document.body.classList.remove('shop-theme');
      document.documentElement.classList.remove('shop-active');
    };
  }, []);

  useEffect(() => {
    let active = true;
    supabase.functions.invoke('smm-panel', { body: { action: 'wallet' } })
      .then(({ data, error }) => {
        if (!active || error || !data || data.error) return;
        setBalance(Number(data.balanceXof) || 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const menuItems = [
    ['Accueil', '/smm'],
    ['Commande', '/smm/commande'],
    ['Compte', '/boutique/compte'],
    ['Nouvel ordre', '/smm/commande'],
    ['Commandes', '/smm/commandes'],
    ['Parrainage', '/smm/parrainage'],
    ['Ajouter des fonds', '/smm/portefeuille'],
    ['Contactez-nous', '/portfolio/#contact'],
  ];

  return (
    <>
      <ShopHeader
        showStoreNav={false}
        brandTo="/smm"
        brandSection="Panel social"
        showMobileButton={false}
        accountLoginTo="/smm/connexion"
        accountLogoutTo="/smm/connexion"
        headerTools={
          <div className="smm-header-tools">
            <details className="smm-header-menu">
              <summary aria-label="Ouvrir le menu du panel SMM">
                <span className="smm-hamburger" aria-hidden="true"><span /><span /><span /></span>
              </summary>
              <nav className="smm-header-menu-list" aria-label="Navigation du panel social">
                {menuItems.map(([label, to]) => (
                  <Link
                    key={`${label}-${to}`}
                    to={to}
                    onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </details>
            <Link className="smm-header-balance" to="/smm/portefeuille">
              <span>Solde</span>
              <strong>{new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(balance)} FCFA</strong>
            </Link>
            <button
              className="smm-header-add"
              type="button"
              aria-label="Ajouter des fonds"
              onClick={() => navigate('/smm/portefeuille')}
            >
              +
            </button>
          </div>
        }
      />
      <Outlet />
    </>
  );
}
