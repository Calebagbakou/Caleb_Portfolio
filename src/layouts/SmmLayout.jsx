import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { getSupabaseFunctionError } from '../utils/supabaseFunctionErrors';
import '../styles/shop.css';
import '../styles/shop-trust.css';

export default function SmmLayout() {
  const { pathname } = useLocation();
  const { user, loading: authLoading } = useAuth();
  const isAuthenticated = Boolean(user?.email_confirmed_at);
  const [balance, setBalance] = useState(null);
  const [balanceError, setBalanceError] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  useLayoutEffect(() => {
    document.body.classList.add('shop-theme');
    document.documentElement.classList.add('shop-active');
    return () => {
      document.body.classList.remove('shop-theme');
      document.documentElement.classList.remove('shop-active');
    };
  }, []);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!isAuthenticated) {
      setBalance(null);
      setBalanceError('');
      return undefined;
    }

    let active = true;
    setBalance(null);
    setBalanceError('');
    async function loadBalance() {
      try {
        const { data, error } = await supabase.functions.invoke('smm-panel', { body: { action: 'wallet' } });
        if (error) throw await getSupabaseFunctionError(error, 'Impossible de charger votre solde.');
        if (data?.error) throw new Error(data.error);
        if (active) setBalance(Number(data?.balanceXof) || 0);
      } catch (error) {
        console.error('Impossible de charger le solde SMM :', error);
        if (active) setBalanceError('Indisponible');
      }
    }
    loadBalance();
    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, user?.id]);

  useEffect(() => {
    setMobileOpen(false);
    document.body.style.overflow = '';
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const menuItems = [
    ['Nouvel ordre', '/smm/commande', 'plus'],
    ['Mes commandes', '/smm/commandes', 'orders'],
    ['Ajouter des fonds', '/smm/portefeuille', 'wallet'],
    ['Parrainage', '/smm/parrainage', 'gift'],
  ];

  const sidebar = (mobile = false) => (
    <div className="smm-sidebar-inner">
      <Link className="smm-sidebar-brand" to="/smm" onClick={() => mobile && setMobileOpen(false)}>
        <span className="smm-sidebar-mark">CC</span>
        <span>Caleb<span>Creative</span><small>Panel SMM</small></span>
      </Link>
      {isAuthenticated && <>
        <small className="smm-sidebar-caption">Menu</small>
        <nav className="smm-sidebar-nav" aria-label="Navigation du panel social">
          {menuItems.map(([label, to, icon]) => (
            <Link key={`${label}-${to}`} to={to} className={pathname === to ? 'is-active' : ''} onClick={() => mobile && setMobileOpen(false)}>
              <span className={`smm-sidebar-icon smm-sidebar-icon-${icon}`} aria-hidden="true" />
              <span>{label}</span>
              {label === 'Parrainage' && <small className="smm-sidebar-badge">50 FCFA</small>}
            </Link>
          ))}
        </nav>
      </>}
      <div className="smm-sidebar-support">
        <strong>Besoin d'aide ?</strong>
        <p>Notre support est disponible pour vous accompagner.</p>
        <Link to="/portfolio/#contact">Contacter le support</Link>
      </div>
    </div>
  );

  const currentTitle = !isAuthenticated
    ? 'Connexion au panel social'
    : menuItems.find(([, to]) => to === pathname)?.[0] || 'Panel social';
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '';
  const initials = userName.split(/[\s@]+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={`smm-template-layout${isAuthenticated ? '' : ' is-guest'}`}>
      <aside className="smm-template-sidebar">{sidebar()}</aside>
      <div
        className={`smm-template-mobile-backdrop${mobileOpen ? ' is-open' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <aside className={`smm-template-mobile-sidebar${mobileOpen ? ' is-open' : ''}`}>
        <button className="smm-template-mobile-close" type="button" aria-label="Fermer le menu" onClick={() => setMobileOpen(false)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {sidebar(true)}
      </aside>
      <div className="smm-template-main">
        <header className="smm-template-header">
          {isAuthenticated && <button className="smm-template-mobile-menu" type="button" aria-label="Ouvrir le menu du panel SMM" onClick={() => setMobileOpen(true)}>
            <span aria-hidden="true">☰</span>
          </button>}
          <strong className="smm-template-title">{currentTitle}</strong>
          <span className="smm-template-header-spacer" />
          {isAuthenticated ? <>
            <Link className="smm-template-wallet" to="/smm/portefeuille">
              <span className="smm-template-wallet-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h12v3M16 12h5v4h-5a2 2 0 0 1 0-4Z" /></svg>
              </span>
              <span>Solde</span>
              <strong>{balanceError || (balance === null ? 'Chargement…' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(balance)} FCFA`)}</strong>
              <b aria-hidden="true">+</b>
            </Link>
            <button className="smm-template-notification" type="button" aria-label="Notifications">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
            <i />
            </button>
            <div className="smm-template-account">
              <span>{initials}</span>
              <div><strong>{userName}</strong><small>Compte client</small></div>
            </div>
          </> : !authLoading && <Link className="smm-template-sign-in" to="/smm/connexion?mode=login&next=%2Fsmm">Se connecter</Link>}
        </header>
        <main className="smm-template-content">
          <Outlet />
        </main>
        <footer className="smm-template-footer">© {new Date().getFullYear()} Caleb Creative · Paiements sécurisés en Francs CFA</footer>
      </div>
    </div>
  );
}
