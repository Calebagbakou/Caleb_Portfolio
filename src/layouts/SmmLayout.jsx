import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import '../styles/shop.css';
import '../styles/shop-trust.css';

export default function SmmLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [balance, setBalance] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userName, setUserName] = useState('Client Caleb');

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Client Caleb';
      setUserName(name);
    });
  }, []);

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
    ['Tableau de bord', '/smm', 'home'],
    ['Nouvel ordre', '/smm/commande', 'plus'],
    ['Services', '/smm/commande', 'services'],
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
      <button className="smm-sidebar-new-order" type="button" onClick={() => { navigate('/smm/commande'); mobile && setMobileOpen(false); }}>
        <span aria-hidden="true">+</span> Nouvelle commande
      </button>
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
      <div className="smm-sidebar-support">
        <strong>Besoin d'aide ?</strong>
        <p>Notre support est disponible pour vous accompagner.</p>
        <Link to="/portfolio/#contact">Contacter le support</Link>
      </div>
    </div>
  );

  const currentTitle = menuItems.find(([, to]) => to === pathname)?.[0] || 'Panel social';
  const initials = userName.split(/[\s@]+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="smm-template-layout">
      <aside className="smm-template-sidebar">{sidebar()}</aside>
      <div
        className={`smm-template-mobile-backdrop${mobileOpen ? ' is-open' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <aside className={`smm-template-mobile-sidebar${mobileOpen ? ' is-open' : ''}`}>
        <button className="smm-template-mobile-close" type="button" aria-label="Fermer le menu" onClick={() => setMobileOpen(false)}>×</button>
        {sidebar(true)}
      </aside>
      <div className="smm-template-main">
        <header className="smm-template-header">
          <button className="smm-template-mobile-menu" type="button" aria-label="Ouvrir le menu du panel SMM" onClick={() => setMobileOpen(true)}>
            <span aria-hidden="true">☰</span>
          </button>
          <strong className="smm-template-title">{currentTitle}</strong>
          <span className="smm-template-header-spacer" />
          <Link className="smm-template-wallet" to="/smm/portefeuille">
            <span>Solde</span>
            <strong>{new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(balance)} FCFA</strong>
            <b aria-hidden="true">+</b>
          </Link>
          <div className="smm-template-account">
            <span>{initials}</span>
            <div><strong>{userName}</strong><small>Compte client</small></div>
          </div>
        </header>
        <main className="smm-template-content">
          <Outlet />
        </main>
        <footer className="smm-template-footer">© {new Date().getFullYear()} Caleb Creative · Paiements sécurisés en Francs CFA</footer>
      </div>
    </div>
  );
}
